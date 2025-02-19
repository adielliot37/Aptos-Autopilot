from flask import Flask, jsonify, request
import pandas as pd
from nixtla import NixtlaClient
import datetime
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Initialize NixtlaClient

NIXTLA_API_KEY = os.getenv("NIXTLA_API_KEY")
if not NIXTLA_API_KEY:
    raise ValueError("NIXTLA_API_KEY not set in environment variables.")

nixtla_client = NixtlaClient(api_key=NIXTLA_API_KEY)

# Load historical Bitcoin price data from bitcoin.csv
#df = pd.read_csv('bitcoin.csv', sep=',')
#df.rename(columns={'Date': 'ds', 'Close': 'y'}, inplace=True)

# Function to get the latest data and make predictions
def get_latest_data_and_predict():
    df = pd.read_csv('bitcoin.csv', sep=',')
    df.rename(columns={'Date': 'ds', 'Close': 'y'}, inplace=True)
    # Assuming the latest data is the last row in the DataFrame
    latest_date = df['ds'].iloc[-1]
    latest_price = df['y'].iloc[-1]

    # Forecast the next 7 days
    level = [50, 80, 90]
    fcst = nixtla_client.forecast(df, h=7, level=level)

    # Get the next day's prediction
    next_day_prediction = fcst.iloc[0]

    return latest_date, latest_price, next_day_prediction

# Function to determine trading signal
def determine_trading_signal(latest_price, next_day_prediction):
    predicted_price = next_day_prediction['TimeGPT']
    if predicted_price > latest_price * 1.005:  # If predicted price is 0.5% higher
        return 'buy'
    return 'hold'  # Only "hold" if price doesn't increase by 0.5%

@app.route('/predict', methods=['GET'])
def predict():
    latest_date, latest_price, next_day_prediction = get_latest_data_and_predict()
    signal = determine_trading_signal(latest_price, next_day_prediction)

    response = {
        'latest_date': latest_date,
        'latest_price': latest_price,
        'next_day_prediction': next_day_prediction.to_dict(),
        'signal': signal
    }
    return jsonify(response)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=3010)