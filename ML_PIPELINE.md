# JUS'TAPP ML Confusion Detection Pipeline

The live backend currently serves `heuristic-v1` for low-latency real-time prediction. This is intentional for production bootstrapping: the app can collect labeled behavior data immediately, then the same schema can train Random Forest, XGBoost, and TensorFlow Lite models.

## Prediction Labels

```text
independent_user
moderate_assistance_needed
high_assistance_needed
critical_guidance_required
```

## Dataset Row Schema

One row should represent one step-level or 10-second interaction window.

```json
{
  "session_id": "session_123",
  "user_id": "user_123",
  "task_id": "task_123",
  "step_index": 2,
  "app_package": "in.irctc.android.app",
  "action_type": "tap",
  "repeated_taps": 3,
  "incorrect_taps": 2,
  "inactivity_ms": 8400,
  "navigation_retries": 2,
  "back_button_count": 1,
  "gesture_accuracy": 0.62,
  "task_completion_ms": 95000,
  "overlay_request_count": 4,
  "hesitation_ms": 5100,
  "wrong_screen_count": 1,
  "same_screen_loop_count": 2,
  "step_duration_ms": 15200,
  "total_tap_count": 8,
  "voice_help_count": 1,
  "label": "high_assistance_needed"
}
```

## Feature Engineering

Use these feature groups:

```text
Tap features: repeated_taps, incorrect_taps, total_tap_count, incorrect_tap_ratio
Navigation features: navigation_retries, back_button_count, wrong_screen_count, same_screen_loop_count
Timing features: inactivity_ms, hesitation_ms, step_duration_ms, task_completion_ms
Guidance features: overlay_request_count, voice_help_count
Gesture features: gesture_accuracy
Context features: app_package, action_type, user baseline score
```

Preprocessing:

```text
1. Fill missing numeric values with 0, except gesture_accuracy defaults to 1.
2. Clip timing outliers at the 99th percentile.
3. Encode categorical values with one-hot encoding.
4. Split by user/session, not random rows, to avoid leakage.
5. Save the exact feature order and preprocessing artifact with each model version.
```

## Training Targets

Baseline:

```text
Random Forest
```

Best tabular model:

```text
XGBoost or LightGBM
```

Mobile-compatible model:

```text
Small TensorFlow dense classifier exported to .tflite
```

## Project Scripts

Generate synthetic expo/training data:

```bash
python3 ml/generate_synthetic_dataset.py --rows 5000 --out ml/data/synthetic_confusion_dataset.csv
```

Install ML dependencies:

```bash
python3 -m pip install -r ml/requirements.txt
```

Compare Logistic Regression, Random Forest, and XGBoost:

```bash
python3 ml/evaluate_confusion_models.py --data ml/data/synthetic_confusion_dataset.csv --out ml/artifacts
```

Export TensorFlow Lite model:

```bash
python3 ml/export_tflite.py --data ml/data/synthetic_confusion_dataset.csv --out ml/artifacts/confusion_model.tflite
```

Generated artifacts:

```text
model_comparison_report.json
model_performance_comparison.png
xgboost_confusion_matrix.png
random_forest_confusion_matrix.png
logistic_regression_confusion_matrix.png
assistance_level_distribution.png
xgboost_feature_importance.png
best_confusion_model.joblib
confusion_model.tflite
```

## Metrics

Track:

```text
accuracy
macro_f1
weighted_f1
per_class_precision
per_class_recall
critical_guidance_required recall
confusion_matrix
p50 inference latency
p95 inference latency
```

Prioritize recall for `critical_guidance_required`. Missing a critical case is worse than occasionally giving extra guidance.

## TFLite Export Workflow

```text
1. Export Mongo interaction data to CSV.
2. Build windowed features.
3. Train TensorFlow classifier.
4. Convert SavedModel to TensorFlow Lite.
5. Quantize to float16 or int8 if mobile latency matters.
6. Ship .tflite to Android only after server model behavior is stable.
```

## Deployment Plan

Phase 1:

```text
Use backend heuristic-v1 and collect real event data.
```

Phase 2:

```text
Train Random Forest and XGBoost offline. Serve the best model from backend.
```

Phase 3:

```text
Train compact TensorFlow model and export .tflite for optional on-device inference.
```

Phase 4:

```text
Use backend model as source of truth and Android TFLite as offline fallback.
```
