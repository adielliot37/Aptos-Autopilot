import requests
import pandas as pd
from datetime import datetime

# Define the API endpoint and parameters
api_url = "https://api.coingecko.com/api/v3/simple/price"
params = {
    'ids': 'bitcoin',
    'vs_currencies': 'usd',
    'include_market_cap': 'false',
    'include_24hr_vol': 'false',
    'include_24hr_change': 'false',
    'include_last_updated_at': 'false'
}

# Fetch the latest Bitcoin price
response = requests.get(api_url, params=params)
data = response.json()

# Extract the closing price
closing_price = data['bitcoin']['usd']

# Get the current date in the format DD-MM-YYYY
current_date = datetime.now().strftime('%d-%m-%Y')

# Create a DataFrame with the new data
new_data = pd.DataFrame({'Date': [current_date], 'Close': [closing_price]})

# Load the existing CSV file
csv_file = './bitcoin.csv'
df = pd.read_csv(csv_file)

# Check if the date already exists in the DataFrame
if current_date not in df['Date'].values:
    # Append the new data to the DataFrame
    df = pd.concat([df, new_data], ignore_index=True)

    # Save the updated DataFrame to the CSV file
    df.to_csv(csv_file, index=False)

    print(f"Updated {csv_file} with the latest Bitcoin data for {current_date}")
else:
    print(f"Data for {current_date} already exists in {csv_file}. No update needed.")