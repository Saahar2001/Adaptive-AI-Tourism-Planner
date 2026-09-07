import os
import pandas as pd

# Automatically targets the 'tourism_app_data' directory relative to this script
DATA_DIR = os.path.join(os.path.dirname(__file__), "tourism_app_data")

def process_datasets():
    # 1. Point of Sale Transactions
    pos_path = os.path.join(DATA_DIR, "point-of-sale-transactions-by-sector-and-city.csv")
    if os.path.exists(pos_path):
        pos_df = pd.read_csv(pos_path)
        pos_df.to_pickle(os.path.join(DATA_DIR, "pos_df.pkl"))
        print(f"✅ Successfully converted POS data to pos_df.pkl (Shape: {pos_df.shape})")

    # 2. Monthly Average Length of Stay
    stay_path = os.path.join(DATA_DIR, "Monthly-Evolution-of-the-Average-Length-of-Stay-according-to-Type-of-Tourist.csv")
    if os.path.exists(stay_path):
        stay_df = pd.read_csv(stay_path)
        stay_df.to_pickle(os.path.join(DATA_DIR, "stay_df.pkl"))
        print(f"✅ Successfully converted Stay data to stay_df.pkl (Shape: {stay_df.shape})")

    # 3. Hotel Occupancy Rates
    occ_path = os.path.join(DATA_DIR, "Occupancy_rates_all_Provinces_2024_4dae5f2abb.xlsx")
    if os.path.exists(occ_path):
        occ_df = pd.read_excel(occ_path)
        occ_df.to_pickle(os.path.join(DATA_DIR, "occupancy_df.pkl"))
        print(f"✅ Successfully converted Occupancy data to occupancy_df.pkl (Shape: {occ_df.shape})")

if __name__ == "__main__":
    process_datasets()