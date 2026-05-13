import argparse
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.model_selection import GroupShuffleSplit


# -----------------------------
# CONFIG
# -----------------------------
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
    "voice_help_count",
]


# -----------------------------
# NORMALIZATION
# -----------------------------
def normalize(df: pd.DataFrame, stats: dict | None = None):
    values = df[NUMERIC_FEATURES].fillna(0).astype("float32")

    # safety clamp
    values["gesture_accuracy"] = values["gesture_accuracy"].replace(0, 1).clip(0, 1)

    if stats is None:
        stats = {
            "mean": values.mean().to_dict(),
            "std": values.std().replace(0, 1).to_dict(),
        }

    normalized = (values - pd.Series(stats["mean"])) / pd.Series(stats["std"])
    return normalized.to_numpy(dtype=np.float32), stats


# -----------------------------
# MODEL
# -----------------------------
def build_model(input_dim: int, num_classes: int):
    model = tf.keras.Sequential([
        tf.keras.Input(shape=(input_dim,)),
        tf.keras.layers.Dense(32, activation="relu"),
        tf.keras.layers.Dense(16, activation="relu"),
        tf.keras.layers.Dense(num_classes, activation="softmax"),
    ])

    model.compile(
        optimizer="adam",
        loss="categorical_crossentropy",
        metrics=["accuracy"]
    )
    return model


# -----------------------------
# MAIN
# -----------------------------
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True)
    parser.add_argument("--out", default="ml/artifacts/confusion_model.tflite")
    args = parser.parse_args()

    # -----------------------------
    # Load data
    # -----------------------------
    df = pd.read_csv(args.data)

    label_map = {label: idx for idx, label in enumerate(LABELS)}
    df["label_id"] = df["label"].map(label_map)

    # -----------------------------
    # Train/test split
    # -----------------------------
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, test_idx = next(
        splitter.split(df, df["label_id"], groups=df["session_id"])
    )

    train_df = df.iloc[train_idx]
    test_df = df.iloc[test_idx]

    # -----------------------------
    # Normalize
    # -----------------------------
    x_train, stats = normalize(train_df)
    x_test, _ = normalize(test_df, stats)

    y_train = tf.keras.utils.to_categorical(train_df["label_id"], num_classes=len(LABELS))
    y_test = tf.keras.utils.to_categorical(test_df["label_id"], num_classes=len(LABELS))

    # -----------------------------
    # Build model
    # -----------------------------
    model = build_model(len(NUMERIC_FEATURES), len(LABELS))

    model.fit(
        x_train,
        y_train,
        validation_data=(x_test, y_test),
        epochs=30,
        batch_size=64,
        verbose=2,
    )

    # -----------------------------
    # SAFE TFLite conversion
    # -----------------------------
    converter = tf.lite.TFLiteConverter.from_keras_model(model)

    # stability settings (important for macOS)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.experimental_enable_resource_variables = True

    # fallback safety (prevents MLIR crash on some TF builds)
    try:
        converter.experimental_new_converter = False
    except Exception:
        pass

    tflite_model = converter.convert()

    # -----------------------------
    # Save outputs
    # -----------------------------
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    out_path.write_bytes(tflite_model)

    (out_path.parent / "tflite_feature_stats.json").write_text(
        json.dumps(
            {
                "labels": LABELS,
                "numeric_features": NUMERIC_FEATURES,
                "normalization": stats,
            },
            indent=2,
        )
    )

    print(f"✅ TFLite model saved to: {out_path}")


if __name__ == "__main__":
    main()