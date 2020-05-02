# Discord Debating
# Because fuck processing csvs from nodejs
import csv
import sys
import json

csvurls = "privateurls.csv"

urls = []

with open(csvurls, encoding="utf8") as csvfile:
    reader = csv.reader(csvfile, delimiter=",")
    for row in reader:
        urls.append({"name": row[0].lower(), "url": row[1]})

f = open("private-urls.json", "w")
f.write(json.dumps(urls))
f.close()
                     
