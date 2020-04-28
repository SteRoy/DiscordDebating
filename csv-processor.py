# Discord Debating
# Because fuck processing csvs from nodejs
import csv
import sys
import json

csvteams = "teams.csv"
csvjudges = "judges.csv"

teams = []
judges = []

with open(csvteams) as csvfile:
    reader = csv.reader(csvfile, delimiter=",")
    next(reader)
    for row in reader:
        teamname = row[0]
        sOne = row[1]
        sTwo = row[2]
        teams.append(teamname.lower())

with open(csvjudges) as csvfile:
    reader = csv.reader(csvfile, delimiter=",")
    next(reader) # skip headers
    for row in reader:
        judges.append(row[0].lower())

regdata = {"teams": teams, "judges": judges}

f = open("regdata.json", "w")
f.write(json.dumps(regdata))
f.close()
                     
