import argparse
import csv
import random
from pathlib import Path

LABELS = {
    "independent_user": {
        "tap_frequency": (0.8, 1.8),
        "repeated_taps": (0, 1),
        "incorrect_taps": (0, 1),
        "inactivity_duration": (300, 2500),
        "retry_count": (0, 1),
        "task_completion_time": (18000, 65000),
        "overlay_request_count": (0, 1),
        "gesture_accuracy": (0.82, 1.0),
        "hesitation_time": (100, 1500),
        "back_button_count": (0, 1),
        "wrong_screen_count": (0, 1),
        "navigation_retries": (0, 1)
    },
    "moderate_assistance_needed": {
        "tap_frequency": (1.1, 2.5),
        "repeated_taps": (1, 3),
        "incorrect_taps": (0, 2),
        "inactivity_duration": (1800, 6500),
        "retry_count": (1, 3),
        "task_completion_time": (45000, 120000),
        "overlay_request_count": (1, 3),
        "gesture_accuracy": (0.68, 0.9),
        "hesitation_time": (1200, 4500),
        "back_button_count": (0, 2),
        "wrong_screen_count": (0, 2),
        "navigation_retries": (1, 3)
    },
    "high_assistance_needed": {
        "tap_frequency": (1.8, 3.8),
        "repeated_taps": (2, 6),
        "incorrect_taps": (2, 5),
        "inactivity_duration": (5000, 14000),
        "retry_count": (2, 6),
        "task_completion_time": (90000, 240000),
        "overlay_request_count": (3, 7),
        "gesture_accuracy": (0.45, 0.75),
        "hesitation_time": (4000, 11000),
        "back_button_count": (2, 5),
        "wrong_screen_count": (1, 4),
        "navigation_retries": (2, 6)
    },
    "critical_guidance_required": {
        "tap_frequency": (2.5, 5.0),
        "repeated_taps": (5, 12),
        "incorrect_taps": (4, 10),
        "inactivity_duration": (11000, 32000),
        "retry_count": (5, 12),
        "task_completion_time": (180000, 520000),
        "overlay_request_count": (6, 15),
        "gesture_accuracy": (0.15, 0.55),
        "hesitation_time": (9000, 26000),
        "back_button_count": (4, 12),
        "wrong_screen_count": (3, 9),
        "navigation_retries": (5, 12)
    }
}

USER_CATEGORIES = ["confident", "moderate", "elderly", "first_time", "highly_confused"]
APP_PACKAGES = ["com.ubercab", "com.whatsapp", "in.irctc.android.app", "com.google.android.youtube", "com.google.android.apps.maps"]
ACTION_TYPES = ["tap", "input", "scroll", "openApp", "wait"]
LABEL_WEIGHTS = [
    ("independent_user", 0.34),
    ("moderate_assistance_needed", 0.28),
    ("high_assistance_needed", 0.23),
    ("critical_guidance_required", 0.15)
]


def weighted_label():
    point = random.random()
    total = 0
    for label, weight in LABEL_WEIGHTS:
        total += weight
        if point <= total:
            return label
    return LABEL_WEIGHTS[-1][0]


def sample(bounds, integer=False):
    low, high = bounds
    if integer:
        return random.randint(int(low), int(high))
    return round(random.uniform(low, high), 3)


def build_record(index):
    label = weighted_label()
    config = LABELS[label]
    step_index = random.randint(0, 8)
    task_completion_time = sample(config["task_completion_time"], True)
    step_duration_ms = int(task_completion_time / max(step_index + 1, 1))
    tap_frequency = sample(config["tap_frequency"])

    return {
        "session_id": f"session_{index // 8:06d}",
        "user_id": f"user_{random.randint(1, 350):04d}",
        "task_id": f"task_{random.randint(1, 1200):05d}",
        "step_index": step_index,
        "user_category": random.choice(USER_CATEGORIES),
        "app_package": random.choice(APP_PACKAGES),
        "action_type": random.choice(ACTION_TYPES),
        "tap_frequency": tap_frequency,
        "repeated_taps": sample(config["repeated_taps"], True),
        "incorrect_taps": sample(config["incorrect_taps"], True),
        "inactivity_duration": sample(config["inactivity_duration"], True),
        "retry_count": sample(config["retry_count"], True),
        "task_completion_time": task_completion_time,
        "overlay_request_count": sample(config["overlay_request_count"], True),
        "gesture_accuracy": sample(config["gesture_accuracy"]),
        "hesitation_time": sample(config["hesitation_time"], True),
        "back_button_count": sample(config["back_button_count"], True),
        "wrong_screen_count": sample(config["wrong_screen_count"], True),
        "navigation_retries": sample(config["navigation_retries"], True),
        "step_duration_ms": step_duration_ms,
        "total_tap_count": int(tap_frequency * max(step_duration_ms / 1000, 1)),
        "voice_help_count": int(sample(config["overlay_request_count"], True) > 4),
        "label": label
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, default=5000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", default="ml/data/synthetic_confusion_dataset.csv")
    args = parser.parse_args()

    random.seed(args.seed)
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    records = [build_record(index) for index in range(args.rows)]

    with output.open("w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(records[0].keys()))
        writer.writeheader()
        writer.writerows(records)

    print(str(output))


if __name__ == "__main__":
    main()
