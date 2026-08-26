import pandas as pd
import numpy as np
import lightgbm as lgb
from sklearn.metrics import classification_report, cohen_kappa_score, confusion_matrix, ConfusionMatrixDisplay
import os
import datetime
import time
import matplotlib.pyplot as plt
import joblib
from tqdm import tqdm

# Create a new directory for this run's outputs
timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
output_dir = f"model/outputs/run_{timestamp}"
os.makedirs(output_dir, exist_ok=True)
print(f"Created output directory: {output_dir}")

# Load prepared data
print("Loading data...")
train_df = pd.read_csv("dataset/train.csv")
test_df = pd.read_csv("dataset/test.csv")

# Separate features and target
X_train = train_df.drop(columns=["esi"])
y_train = train_df["esi"].astype(int)

print("\nTraining Data ESI Counts:")
print(y_train.value_counts().sort_index())

X_test = test_df.drop(columns=["esi"])
y_test = test_df["esi"].astype(int)

# Create sample weights for ordinal regression approach
weight_map = {1: 2.5, 2: 1.0, 3: 0.8, 4: 1.0, 5: 1.5}
sample_weights = y_train.map(weight_map)

# Train LightGBM regression model for ordinal classification
print("Initializing model...")
model = lgb.LGBMRegressor(
    objective="regression",
    metric="rmse",
    n_estimators=1000,
    learning_rate=0.05,
    num_leaves=63,
    min_child_samples=120,    # Increased to prevent overfitting on ESI 1/5
    subsample=0.8,
    colsample_bytree=0.8,
    max_bin=255,              # Added for explicit regression granularity
    random_state=42,
    verbose=-1
)

# Custom tqdm callback for LightGBM
def tqdm_callback(pbar):
    def callback(env):
        pbar.update(1)
        if env.evaluation_result_list:
            metric_name = env.evaluation_result_list[0][1]
            metric_val = env.evaluation_result_list[0][2]
            pbar.set_postfix({metric_name: f"{metric_val:.4f}"})
    return callback

print("Starting training...")
start_time = time.time()

with tqdm(total=1000, desc="Training Progress") as pbar:
    model.fit(
        X_train, y_train,
        sample_weight=sample_weights,
        eval_set=[(X_test, y_test)],
        eval_metric="rmse",
        callbacks=[
            lgb.early_stopping(100, verbose=False),
            tqdm_callback(pbar)
        ]
    )

end_time = time.time()
print(f"\nTraining completed in {end_time - start_time:.2f} seconds.")

# Predictions
print("Evaluating model...")
# Predict and round to nearest integer, bound between 1 and 5
y_pred_continuous = model.predict(X_test)
y_pred = np.clip(np.round(y_pred_continuous), 1, 5).astype(int)

# Evaluation
report = classification_report(y_test, y_pred)
print("\nClassification Report:")
print(report)

kappa = cohen_kappa_score(y_test, y_pred, weights="quadratic")
print(f"Quadratic Weighted Kappa: {kappa:.3f}")

# Confusion Matrix
cm = confusion_matrix(y_test, y_pred)
print("\nConfusion Matrix:")
print(cm)

disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=[1, 2, 3, 4, 5])
fig, ax = plt.subplots(figsize=(8, 6))
disp.plot(cmap="Blues", ax=ax)
plt.title("Confusion Matrix")
plt.tight_layout()
plt.savefig(os.path.join(output_dir, "confusion_matrix.png"))
plt.close()

# Save metrics
with open(os.path.join(output_dir, "metrics.txt"), "w") as f:
    f.write(f"Training completed in {end_time - start_time:.2f} seconds.\n\n")
    f.write("Training Data ESI Counts:\n")
    f.write(y_train.value_counts().sort_index().to_string() + "\n\n")
    f.write("Classification Report:\n")
    f.write(report + "\n\n")
    f.write(f"Quadratic Weighted Kappa: {kappa:.3f}\n\n")
    f.write("Confusion Matrix:\n")
    f.write(str(cm) + "\n")

# Feature importance (top 20)
importance = pd.DataFrame({
    "feature": X_train.columns,
    "importance": model.feature_importances_
}).sort_values("importance", ascending=False)

print("\nTop 20 Features:")
print(importance.head(20))
importance.to_csv(os.path.join(output_dir, "feature_importance.csv"), index=False)

# Plot feature importance
plt.figure(figsize=(10, 8))
importance.head(20).sort_values("importance", ascending=True).plot.barh(x="feature", y="importance", legend=False)
plt.title("Top 20 Feature Importances")
plt.xlabel("Importance")
plt.tight_layout()
plt.savefig(os.path.join(output_dir, "feature_importance.png"))
plt.close()

# Save the model
joblib.dump(model, os.path.join(output_dir, "lgbm_model.pkl"))
print(f"\nAll results, graphs, and model saved to {output_dir}")
