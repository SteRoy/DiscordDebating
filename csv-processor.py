# Discord Debating
# Because fuck processing csvs from nodejs
import csv
import sys
import json

csvteams = "teams.csv"
csvjudges = "judges.csv"

teams = []
judges = []
speakers = []
safeguardS = []
safeguardJ = []

with open(csvteams, encoding="utf8") as csvfile:
    reader = csv.reader(csvfile, delimiter=",")
    next(reader)
    for row in reader:
        teamname = row[0]
        sOne = row[1]
        sTwo = row[2]
        safeguard = row[3]
        if safeguard.lower().replace(" ", "") == "child":
            safeguard = True
        else:
            safeguard = False
        teams.append(teamname.lower())
        speakers.append(sOne.lower())
        safeguardS.append(safeguard)
        speakers.append(sTwo.lower())
        safeguardS.append(safeguard)

with open(csvjudges, encoding="utf8") as csvfile:
    reader = csv.reader(csvfile, delimiter=",")
    next(reader) # skip headers
    for row in reader:
        judges.append(row[0].lower())
        if row[1].lower().replace(" ", "") == "child":
            safeguardJ.append(True)
        else:
            safeguardJ.append(False)

regdata = {"teams": teams, "judges": judges, "speakers": speakers, "childrenS": safeguardS, "childrenJ": safeguardJ}

f = open("regdata.json", "w")
f.write(json.dumps(regdata))
f.close()
                     
