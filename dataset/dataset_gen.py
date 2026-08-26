import pandas as pd
from datasets import load_dataset
from sklearn.model_selection import train_test_split
import os

# Load dataset
ds = load_dataset("kondratevakate/hospital-triage-and-patient-history-data", split="train")
df = ds.to_pandas()

# 1. Select triage-relevant columns
vital_cols = [
    "triage_vital_hr",
    "triage_vital_sbp",
    "triage_vital_dbp",
    "triage_vital_rr",
    "triage_vital_o2",
    "triage_vital_temp"
]

cc_cols = [col for col in df.columns if col.startswith("cc_")]
selected_cols = ["age", "gender", "esi"] + vital_cols + cc_cols
df = df[selected_cols]

# 2. Drop rows where essential identifiers are missing
#    (we keep rows with missing vitals – LightGBM will handle them)
essential_cols = ["age", "gender", "esi"]
df = df.dropna(subset=essential_cols)

# 3. Sample 50k rows (after dropping essential missing)
if len(df) > 50000:
    df = df.sample(n=50000, random_state=42)

# 4. Encode gender: Male -> 1, Female -> 0, other -> 2
df["gender"] = df["gender"].map({"Male": 1, "Female": 0}).fillna(2).astype(int)

# 5. Fill missing chief complaints with 0 (absence = not reported)
df[cc_cols] = df[cc_cols].fillna(0)

# 6. Split into train/test (stratified by ESI)
train_df, test_df = train_test_split(
    df, test_size=0.2, random_state=42, stratify=df["esi"]
)

# 7. Save as CSV (missing vitals remain as empty cells)
os.makedirs("dataset", exist_ok=True)
train_df.to_csv("dataset/train.csv", index=False)
test_df.to_csv("dataset/test.csv", index=False)

print(f"Train shape: {train_df.shape}")
print(f"Test shape: {test_df.shape}")
print("Saved train.csv and test.csv in dataset/ folder.")