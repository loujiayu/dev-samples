import csv
from os import path

source = path.join(path.dirname(__file__), 'Video.csv')

headers = [
  'Bid Strategy',
  'CurrencyName',
  'DefaultFloorPrice',
  'DefaultCeilingPrice',
  'UI Notification floor',
  'UI Nitification Ceiling',
  'Budget UI'
]

def formatData(data):
    if data[0] == 'vCPM':
        data[0] = 'CPM'
    elif data[0] == 'CPCV':
        data[0] = 'CPV'

    data[1] = data[1].replace(' ', '')

# new BidPriceDetail { BidTargetType = OrderItemBidTargetType.VideoViews, PricingModel = PricingModel.CPM, Currency=Currency.AustralianDollar, DefaultFloorPrice = 4, DefaultCeilingPrice = 150 }

with open(source, 'r') as f:
    reader = csv.reader(f)
    for index, row in enumerate(reader):
        if index == 0:
            continue
        
        formatData(row)
        
        print('new BidPriceDetail {{ BidTargetType = OrderItemBidTargetType.VideoViews, PricingModel = PricingModel.{}, Currency=Currency.{}, DefaultFloorPrice = {}, DefaultCeilingPrice = {} }}, '.format(row[0], row[1], row[4], row[5]))


