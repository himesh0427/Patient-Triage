import pandas as pd
import numpy as np
from datasets import load_dataset
from sklearn.model_selection import train_test_split
import os

print("Loading full dataset from Hugging Face...")
ds = load_dataset("kondratevakate/hospital-triage-and-patient-history-data", split="train")
df = ds.to_pandas()
print(f"Full dataset: {df.shape[0]} rows, {df.shape[1]} columns")

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

essential_cols = ["age", "gender", "esi"]
df = df.dropna(subset=essential_cols)
print(f"After dropping missing age/gender/esi: {len(df)} rows")

sparse_cc = [col for col in cc_cols if (df[col] == 1).sum() < 500]
df = df.drop(columns=sparse_cc)
cc_cols = [col for col in cc_cols if col not in sparse_cc]
print(f"Dropped {len(sparse_cc)} sparse cc_* columns, kept {len(cc_cols)}")

df["gender"] = df["gender"].map({"Male": 1, "Female": 0}).fillna(2).astype(int)
df[cc_cols] = df[cc_cols].fillna(0)

df["n_chief_complaints"] = df[cc_cols].sum(axis=1).astype(int)
df["has_vitals"] = df[vital_cols].notna().any(axis=1).astype(int)
df["n_vitals_recorded"] = df[vital_cols].notna().sum(axis=1).astype(int)

print(f"\nEngineered features added: n_chief_complaints, has_vitals, n_vitals_recorded")

df["esi"] = df["esi"].astype(int)

caps = {1: None, 2: 50000, 3: 50000, 4: 50000, 5: None}

sampled_dfs = []
for esi_level, cap in caps.items():
    esi_subset = df[df["esi"] == esi_level]
    if cap is not None and len(esi_subset) > cap:
        esi_subset = esi_subset.sample(n=cap, random_state=42)
    sampled_dfs.append(esi_subset)
    print(f"ESI {esi_level}: {len(esi_subset)} rows {'(ALL)' if cap is None else f'(capped at {cap})'}")

df_sampled = pd.concat(sampled_dfs, ignore_index=True)
print(f"\nTotal sampled: {len(df_sampled)} rows")

train_df, test_df = train_test_split(
    df_sampled, test_size=0.2, random_state=42, stratify=df_sampled["esi"]
)

os.makedirs("dataset", exist_ok=True)
train_df.to_csv("dataset/train.csv", index=False)
test_df.to_csv("dataset/test.csv", index=False)

print(f"\nTrain shape: {train_df.shape}")
print(f"Test shape: {test_df.shape}")

print("\nTrain ESI distribution:")
print(train_df["esi"].value_counts().sort_index())

print("\nTest ESI distribution:")
print(test_df["esi"].value_counts().sort_index())

print("\nSaved train.csv and test.csv in dataset/ folder.")
