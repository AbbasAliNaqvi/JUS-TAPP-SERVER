import argparse
import json
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier

LABELS = [
    "independent_user",
    "moderate_assistance_needed",
    "high_assistance_needed",
    "critical_guidance_required"
]

NUMERIC_FEATURES = [
    "tap_frequency",
    "repeated_taps",
    "incorrect_taps",
    "inactivity_duration",
    "retry_count",
    "task_completion_time",
    "overlay_request_count",
    "gesture_accuracy",
    "hesitation_time",
    "back_button_count",
    "wrong_screen_count",
    "navigation_retries",
    "step_duration_ms",
    "total_tap_count",
    "voice_help_count"
]

CATEGORICAL_FEATURES = ["app_package", "action_type", "user_category"]


def prepare_data(path):
    df = pd.read_csv(path)
    df[NUMERIC_FEATURES] = df[NUMERIC_FEATURES].fillna(0)
    df[CATEGORICAL_FEATURES] = df[CATEGORICAL_FEATURES].fillna("unknown")
    df["label_id"] = df["label"].map({label: index for index, label in enumerate(LABELS)})
    return df


def build_model(name):
    preprocessor = ColumnTransformer([
        ("num", StandardScaler(), NUMERIC_FEATURES),
        ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES)
    ])

    models = {
        "logistic_regression": LogisticRegression(max_iter=2500, class_weight="balanced"),
        "random_forest": RandomForestClassifier(n_estimators=350, max_depth=14, random_state=42, class_weight="balanced", n_jobs=-1),
        "xgboost": XGBClassifier(
            objective="multi:softprob",
            num_class=len(LABELS),
            eval_metric="mlogloss",
            n_estimators=320,
            max_depth=5,
            learning_rate=0.045,
            subsample=0.9,
            colsample_bytree=0.9
        )
    }

    return Pipeline([("preprocess", preprocessor), ("model", models[name])])


def save_bar_chart(metrics, output_dir):
    chart_df = pd.DataFrame([
        {"model": name, "metric": metric, "value": values[metric]}
        for name, values in metrics.items()
        for metric in ["accuracy", "precision", "recall", "f1"]
    ])
    plt.figure(figsize=(10, 6))
    sns.barplot(data=chart_df, x="model", y="value", hue="metric")
    plt.ylim(0, 1)
    plt.title("Model Performance Comparison")
    plt.tight_layout()
    plt.savefig(output_dir / "model_performance_comparison.png", dpi=180)
    plt.close()


def save_confusion_matrix(matrix, output_dir, model_name):
    plt.figure(figsize=(8, 6))
    sns.heatmap(matrix, annot=True, fmt="d", cmap="Blues", xticklabels=LABELS, yticklabels=LABELS)
    plt.xlabel("Predicted")
    plt.ylabel("Actual")
    plt.title(f"{model_name} Confusion Matrix")
    plt.tight_layout()
    plt.savefig(output_dir / f"{model_name}_confusion_matrix.png", dpi=180)
    plt.close()


def save_distribution_chart(df, output_dir):
    plt.figure(figsize=(9, 5))
    sns.countplot(data=df, x="label", order=LABELS)
    plt.title("Assistance Level Distribution")
    plt.xticks(rotation=20, ha="right")
    plt.tight_layout()
    plt.savefig(output_dir / "assistance_level_distribution.png", dpi=180)
    plt.close()


def save_feature_importance(pipeline, output_dir):
    model = pipeline.named_steps["model"]
    preprocessor = pipeline.named_steps["preprocess"]
    if not hasattr(model, "feature_importances_"):
      return

    names = list(preprocessor.get_feature_names_out())
    importance = pd.DataFrame({
        "feature": names,
        "importance": model.feature_importances_
    }).sort_values("importance", ascending=False).head(15)

    importance.to_csv(output_dir / "xgboost_feature_importance.csv", index=False)
    plt.figure(figsize=(10, 6))
    sns.barplot(data=importance, x="importance", y="feature")
    plt.title("XGBoost Feature Importance")
    plt.tight_layout()
    plt.savefig(output_dir / "xgboost_feature_importance.png", dpi=180)
    plt.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True)
    parser.add_argument("--out", default="ml/artifacts")
    args = parser.parse_args()

    output_dir = Path(args.out)
    output_dir.mkdir(parents=True, exist_ok=True)

    df = prepare_data(args.data)
    splitter = GroupShuffleSplit(test_size=0.2, n_splits=1, random_state=42)
    train_index, test_index = next(splitter.split(df, df["label_id"], groups=df["session_id"]))
    train_df = df.iloc[train_index]
    test_df = df.iloc[test_index]

    metrics = {}
    matrices = {}
    fitted = {}

    for model_name in ["logistic_regression", "random_forest", "xgboost"]:
        pipeline = build_model(model_name)
        pipeline.fit(train_df[NUMERIC_FEATURES + CATEGORICAL_FEATURES], train_df["label_id"])
        predicted = pipeline.predict(test_df[NUMERIC_FEATURES + CATEGORICAL_FEATURES])
        metrics[model_name] = {
            "accuracy": accuracy_score(test_df["label_id"], predicted),
            "precision": precision_score(test_df["label_id"], predicted, average="macro", zero_division=0),
            "recall": recall_score(test_df["label_id"], predicted, average="macro", zero_division=0),
            "f1": f1_score(test_df["label_id"], predicted, average="macro", zero_division=0),
            "classification_report": classification_report(test_df["label_id"], predicted, target_names=LABELS, output_dict=True, zero_division=0)
        }
        matrices[model_name] = confusion_matrix(test_df["label_id"], predicted).tolist()
        fitted[model_name] = pipeline
        joblib.dump(pipeline, output_dir / f"{model_name}.joblib")
        save_confusion_matrix(matrices[model_name], output_dir, model_name)

    best_model = max(metrics, key=lambda name: metrics[name]["f1"])
    joblib.dump(fitted[best_model], output_dir / "best_confusion_model.joblib")
    save_bar_chart(metrics, output_dir)
    save_distribution_chart(df, output_dir)
    if best_model == "xgboost":
        save_feature_importance(fitted[best_model], output_dir)

    result = {
        "best_model": best_model,
        "labels": LABELS,
        "metrics": metrics,
        "confusion_matrices": matrices,
        "feature_order": NUMERIC_FEATURES + CATEGORICAL_FEATURES
    }
    (output_dir / "model_comparison_report.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
