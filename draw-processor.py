# Discord Debating
# Because fuck processing HTML/doing requests from fucking node.js
from bs4 import BeautifulSoup
import requests
import sys
import json

tournament_url = sys.argv[1]
sessionid = sys.argv[2]
csrftoken = sys.argv[3]
round_counter = sys.argv[4]

cookies = {"sessionid" : sessionid, "csrftoken": csrftoken}
non_bmp_map = dict.fromkeys(range(0x10000, sys.maxunicode + 1), 0xfffd)
r = requests.get(tournament_url + "/" + str(round_counter) + "/display-by-venue/", cookies=cookies)
r.encoding = "UTF-8"

soup = BeautifulSoup(r.text.translate(non_bmp_map), "html.parser")
venues = soup.find_all("script")


parsedData = json.loads(venues[1].string[79:-9].replace("tablesData", "\"tablesData\"") + "}")["tablesData"][0]
debates = []
for row in parsedData["data"]:
    venueName = row[0]["text"]
    teams = []
    for i in range(1, len(row) - 1):
        teams.append(row[i]["text"])

    adjSoup = BeautifulSoup(row[-1]["text"].replace("<i class='adj-symbol'>\u24d2</i>", ""), "html.parser")
    adj = adjSoup.find_all("span")
    adjString = ""
    for a in adj:
        adjString += a.string.replace(", ", ",")
    adj = adjString.split(",")
    debates.append({"venue": venueName, "teams": teams, "chair": adj[0], "panel": adj[1:]})

f = open("round-" + str(round_counter) + ".json", "w")
f.write(json.dumps(debates))
f.close()
