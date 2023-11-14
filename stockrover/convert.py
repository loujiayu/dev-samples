import csv
import json
from sample import chart_data

investments = [-1000, 0, 1000, 1200, 1400]

def convert_per_record(item):
  invest_money = investments[int(item['starRating']) - 1]
  return [
    item['bf'][0],
    'MSFT',
    'Microsoft',
    'Stock',
    'Buy' if invest_money > 0 else 'Sell',
    invest_money / float(item['close']),
    item['close'],
    abs(invest_money),
  ]

def convert_chart_to_profile():
  chart = json.loads(chart_data)
  nested_list = list(map(lambda c: c['monthly'], chart[-5:]))
  flattened_list = [item for sublist in nested_list for item in sublist]
  return map(convert_per_record, flattened_list)


with open('profiles1.csv', 'w', newline='') as file:
  writer = csv.writer(file)
  profiles = convert_chart_to_profile()
  field = ["Date", "Ticker", "Name", 'Equity Type', 'Action', 'Quantity', 'Price', 'Amount']
  
  writer.writerow(field)

  for profile in profiles:
    writer.writerow(profile)
  # writer.writerow(["Oladele Damilola", "40", "Nigeria"])
  # writer.writerow(["Alina Hricko", "23", "Ukraine"])
  # writer.writerow(["Isabel Walter", "50", "United Kingdom"])



# Date,Ticker,Name,Equity Type,Action,Quantity,Price,Amount,Balance,Average Cost
# 2022-10-11,GOOG,Alphabet,Stock,Sell,-100,$98.05 ,$981 ,390,$75.67 
# 10/1/2020,GOOG,Alphabet,Stock,Buy,100,$87.59 ,"($8,759)",400,$75.67 