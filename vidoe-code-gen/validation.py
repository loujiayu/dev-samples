import csv
from os import path

source = path.join(path.dirname(__file__), 'Video.csv')


headers = [
  'CurrencyName',

]


with open(source, 'r') as f:
    reader = csv.reader(f)
    for index, row in enumerate(reader):
        if index == 0:
            continue
        if row[6] == '':
            continue

        print('case Currency.{}:'.format(row[1].replace(' ', '')))
        print(' minBudget = {};'.format(row[6]))
        print(' break;')
        