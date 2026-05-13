import argparse
import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier

LABELS = [
    "independent_user",
    "moderate_assistance_needed",
    "high_assistance_needed",
    "critical_guidance_required",
]

NUMERIC_FEATURES = [
    "tap_frequency",
    "repeated_taps",
    "incorrect_taps",
    "inactivity_duration",
    "retry_count",
    "task_completion_time",
    "overlay_request_count",
    "hesitation_time",
    "navigation_retries",
    "back_button_count",
    "gesture_accuracy",
    "wrong_screen_count",
    "step_duration_ms",
    "total_tap_count",
    "voice_help_count"
]

CATEGORICAL_FEATURES = ["app_package", "action_type", "user_category"]


def load_dataset(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    required = set(NUMERIC_FEATURES + CATEGORICAL_FEATURES + ["label", "session_id"])
    missing = sorted(required - set(df.columns))
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    df[NUMERIC_FEATURES] = df[NUMERIC_FEATURES].fillna(0)
    df["gesture_accuracy"] = df["gesture_accuracy"].replace(0, 1).clip(0, 1)
    df[CATEGORICAL_FEATURES] = df[CATEGORICAL_FEATURES].fillna("unknown")
    df["label_id"] = df["label"].map({label: idx for idx, label in enumerate(LABELS)})
    if df["label_id"].isna().any():
        raise ValueError("Dataset contains unknown labels")
    return df


def build_pipeline(model_name: str) -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERIC_FEATURES),
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
        ]
    )

    if model_name == "xgboost":
        model = XGBClassifier(
            objective="multi:softprob",
            num_class=len(LABELS),
            eval_metric="mlogloss",
            n_estimators=240,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
        )
    else:
        model = RandomForestClassifier(
            n_estimators=300,
            max_depth=12,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )

    return Pipeline([("preprocess", preprocessor), ("model", model)])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="CSV dataset path")
    parser.add_argument("--model", choices=["random_forest", "xgboost"], default="random_forest")
    parser.add_argument("--out", default="ml/artifacts", help="Output directory")
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    df = load_dataset(Path(args.data))
    splitter = GroupShuffleSplit(test_size=0.2, n_splits=1, random_state=42)
    train_idx, test_idx = next(splitter.split(df, df["label_id"], groups=df["session_id"]))

    train_df = df.iloc[train_idx]
    test_df = df.iloc[test_idx]

    pipeline = build_pipeline(args.model)
    pipeline.fit(train_df[NUMERIC_FEATURES + CATEGORICAL_FEATURES], train_df["label_id"])

    predictions = pipeline.predict(test_df[NUMERIC_FEATURES + CATEGORICAL_FEATURES])
    metrics = {
        "model": args.model,
        "accuracy": accuracy_score(test_df["label_id"], predictions),
        "macro_f1": f1_score(test_df["label_id"], predictions, average="macro"),
        "weighted_f1": f1_score(test_df["label_id"], predictions, average="weighted"),
        "labels": LABELS,
        "classification_report": classification_report(
            test_df["label_id"],
            predictions,
            target_names=LABELS,
            output_dict=True,
            zero_division=0,
        ),
        "confusion_matrix": confusion_matrix(test_df["label_id"], predictions).tolist(),
        "feature_order": NUMERIC_FEATURES + CATEGORICAL_FEATURES,
    }

    joblib.dump(pipeline, out_dir / f"{args.model}_confusion.joblib")
    (out_dir / f"{args.model}_metrics.json").write_text(json.dumps(metrics, indent=2))
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
