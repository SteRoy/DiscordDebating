const Discord = require('discord.js');
const fs = require('fs');
const spawn = require("child_process").spawn;
const client = new Discord.Client();

// TODO: remember to put the saveToFiles() back into the readreg and readdraw commands
// TODO: add indicator that reg data is imported

let token;
let tournament_url;
let sessionid;
let csrftoken;

let comp_status;
let prep_start;


var competition;
fs.readFile(".config", (err,data) => {
	dict = JSON.parse(data);
	token = dict.token;
	sessionid = dict.sessionid;
	tournament_url = dict["tournament_url"];
	csrftoken = dict.csrftoken;
	client.login(token);
});
fs.readFile('tournament.json', (err, data) => {
	competition = JSON.parse(data);
	console.log(`Restoring a tournament with ${competition.teams.length} registered teams, and ${competition.judges.length} judges.`);
});

function isAuthorised(user, level, exclusive) {
	if (exclusive) {
		return doesUserHaveRole(user, level).then(res => {
			return res;
		});
	} else {
		getRoleByName(user.guild.roles, level).then(role => {
			if (highestRole.comparePositionTo(role.first()) >= 0) {
				return true;
			}
		});
	}
	return false;
}

function doesUserHaveRole(user, roleName) {
	return getRoleByName(user.guild.roles, roleName).then(roleID => {
			if (user.roles.cache.has(roleID.firstKey())) {
				return true;
			} else {
				return false;
			}
	});
}

function getRoleByName(rm, name) {
	return rm.fetch().then(roles => roles.cache.filter( role => role.name === name ));
}

function helpCommand(msg) {
	const embedMessage = new Discord.MessageEmbed()
		.setTitle("Debating Bot Help")
		.setAuthor("Debating Bot")
		.addFields(
			{
				name: "Bot Utility", value: "**!help** - prints a list of usable commands."
			},
			{
				name: "Chair Judge Commands", value: "**!prepleft** - Notifies you of the amount of preperation time remaining"
			},
			{
				name: "Tab Commands", value: "**!readreg** - Read the registered team csvs into memory \n **!readdraw** - Read the draw from tab \n **!run-team-draw** - Create debating venues and allocate teams \n **!venue** <Name> - Manually create a debating venue \n **!delvenue** <Name> - Delete a debating venue \n **!allocate** <@Name> <Room> - Manually allocate a person to a voice channel"
			},
			{
				name: "Speaker Commands", value: "**!register** <Your Name> <Speaker/Judge> - register yourself as a Speaker"
			},
			{
				name: "Team Commands", value: "**!team** <@Teammate> <Team Name> - register a team with your teammate. \n **!disband** - disbands your current team."
			}
		);
	
	msg.reply(embedMessage);
}

function registerUser(msg, name, type) {
	const fullname = name.join(" ");
	const targetGM = msg.member;
	const roleName = (type.toLowerCase() == "speaker" ? "Speaker" : "Judge");
	if (isAuthorised(targetGM, "@everyone", true)) {
		getRoleByName(msg.guild.roles, roleName).then(speakerRole => {
			if (roleName === "Judge") {
				if (competition.regdata.judges.includes(fullname.toLowerCase())) {
					storeJudge(targetGM, fullname);
				} else {
					msg.reply("You are not a registered adjudicator");
					return false;
				}
			}
			targetGM.setNickname(fullname).catch(console.error);
			targetGM.roles.add(speakerRole).catch(console.error);
			msg.reply(`Registered ${fullname} as a ${roleName}.`);
		});
	} else {
		msg.reply("You have already registered!");
	}
}

function storeTeam(speakerOne, speakerTwo, teamName) {
	competition.teams.push({name: teamName.lower(), speakers: [speakerOne.id, speakerTwo.id]});
	saveToFile();
}

function findSpeakersForTeamByName(name) {
	return competition.teams.find(team => team.name == name.lower() ).speakers;
}

function storeJudge(adj, fname) {
	competition.judges.push({name: fname, id: adj.id});
	saveToFile();
}

function saveToFile() {
	fs.writeFile('tournament.json', JSON.stringify(competition), err => {
		if (err) throw err;
		});
}

function unregisterTeam(msg) {
	const teamMember = msg.member;
	const teamsToRemove = competition.teams.filter(team => team.speakers.includes(teamMember.id) );
	const teamRemoveIndex = competition.teams.indexOf(teamsToRemove[0]);
	getRoleByName(msg.guild.roles, "On Team").then(teamRole => {
		teamsToRemove[0].speakers.forEach(speakerID => {
			msg.guild.members.fetch(speakerID).then(speakerObject => {
				speakerObject.roles.remove(teamRole).catch(console.error);
				speakerObject.setNickname(`${speakerObject.nickname.split("] ").pop()}`);
			});
		});
	});
	competition.teams.splice(teamRemoveIndex, 1);
	saveToFile();
	msg.reply("Your team has been disbanded.");
}

function registerTeam(msg, name) {
	const teamname = name.join(" ");
	const speakerOne = msg.member;
	const speakerTwo = msg.mentions.members.first();
	if (typeof(speakerTwo) === typeof(undefined)) {
		msg.reply("Invalid teammate");
	} else {
		getRoleByName(msg.guild.roles, "Speaker").then(speakerRole => {
			if (speakerOne.roles.cache.has(speakerRole.firstKey()) && speakerTwo.roles.cache.has(speakerRole.firstKey())) {
				if (competition.regdata.teams.includes(teamname.toLowerCase())) {
					getRoleByName(msg.guild.roles, "On Team").then(teamRole => {
						if (speakerOne.roles.cache.has(teamRole.firstKey()) || speakerTwo.roles.cache.has(teamRole.firstKey())) {
							msg.reply("You have already registered a team.");
						} else {
							storeTeam(speakerOne, speakerTwo, teamname);
							speakerOne.setNickname(`[${teamname}] ${speakerOne.nickname.split("] ").pop()}`.substring(0,32));
							speakerTwo.setNickname(`[${teamname}] ${speakerTwo.nickname.split("] ").pop()}`.substring(0,32));
							speakerOne.roles.add(teamRole).catch(console.error);
							speakerTwo.roles.add(teamRole).catch(console.error);
						}
					});
				} else {
					msg.reply("Not a registered team name!");
				}
			} else {
				msg.reply("Both speakers must register as a speaker using !register.");
			}
		});
	}
}

function getChannelByName(guild, channelName) {
	return guild.channels.cache.find(channel => channel.name === channelName);
}

function createDebatingRoom(guild, roomName) {
	// Create Category
	const debatePositions = ["OG", "OO", "CG", "CO"];
	guild.channels.create(roomName, {type: "category"}).then(category => {
		debatePositions.forEach(pos => {
			guild.channels.create(`${pos} - Prep Room [${roomName}]`, { type: "voice",  parent: category.id, userLimit: 2 });
		});
		guild.channels.create(`${roomName} - Debate Room`, { type: "voice",  parent: category.id});
		guild.channels.create(`${roomName} - Judges Room`, { type: "voice",  parent: category.id});
		guild.channels.create(`${roomName} - Info`, { type: "text",  parent: category.id});
	});
}

function deleteCategory(guild, roomName, msg) {
	const category = guild.channels.cache.find(channel => channel.name === roomName);
	if (typeof(category) !== typeof(undefined)) {
		category.children.forEach(channel => {
			channel.delete();
		});
		category.delete();
		msg.reply(`I've deleted ${roomName}`);
	} else {
		msg.reply(`Channel not found`);
	}
}

function allocateUserToRoom(guild, userID, channelName) {
	const newChannel = getChannelByName(guild, channelName);
	console.log(newChannel);
	if (typeof(newChannel) === typeof(undefined)) {
		console.log(`Invalid assignment channel specified for ${userID$} - ${channelName}`);
	} else {
		guild.members.fetch(userID).then(user => {
			if (user.voice.channel !== null){
				user.voice.setChannel(newChannel);
			} else {
				console.log(`${user.nickname} is not in a voice channel - ${newChannel.name}`);
			}
		});
	}
}

function assignTeamToRoom(guild, teamName, roomName, pos) {
	// position validated
	guild.channels.find(channel => channel.name === roomName);
	if (typeof(category) !== typeof(undefined)) {
		const speakers competition.teams.find(t => t.name.toLowerCase() === teamName.toLowerCase()).speakers;
		speakers.forEach(s => {
			if (pos !== "debate") {
				allocateUserToRoom(guild, s, `${pos} - Prep Room [${roomName}]`);
			} else {
				allocateUserToRoom(guild, s, `${roomName} - Debate Room`);
			}
		});
	} else {
		// Room not found rip
		console.log(`Failed to assign ${teamName} in ${pos} to ${roomName}.`);
	}
}

function getAndReadDraw(msg) {
	const current_round = competition.rounds.length + 1;
	const python = spawn('python', ['draw-processor.py', tournament_url, sessionid, csrftoken, current_round]);
	
	python.stdout.on('close', (err) => {
		console.log("Trying to read file");
		fs.readFile(`round-${current_round}.json`, (err, data) => {
			const x = JSON.parse(data);
			competition.rounds.push(x);
			let teamcount = 0;
			let adjcount = 0;
			let chaircount = 0;
			x.forEach(venue => {
				venue.teams.forEach(t => {
					if (!(competition.regdata.teams.includes(t.toLowerCase()))) {
						msg.reply(`${t} does not exist in registration data!`);
					}
					teamcount++;
				});
				venue.panel.forEach(a => {
					a.split(",").forEach(as => {	
						if (!(competition.regdata.judges.includes(as.toLowerCase()))) {
							msg.reply(`${as} does not exist in registration data!`);
						}
						adjcount++;
					});
				});
				if (venue.chair !== "") {
					if (!(competition.regdata.judges.includes(venue.chair.toLowerCase()))) {
						msg.reply(`${venue.chair} does not exist in registration data!`);
					}
					chaircount++;
				}
			});
			msg.reply(`Loaded ${x.length} venues comprised of ${teamcount} teams, ${chaircount} chairs and ${adjcount} panellists.`);
			//saveToFile();
		});
	});
}

function processRegData(msg) {
	const python = spawn('python', ['csv-processor.py']);
	python.stdout.on('close', (err) => {
		fs.readFile('regdata.json', (err, data) => {
			const x = JSON.parse(data);
			competition.regdata = x;
			console.log(x);
			msg.reply(`Loaded ${competition.regdata.teams.length} registered teams, ${competition.regdata.judges.length} registered judges!`);
			//saveToFile();
		});
	});
}

function allocateAllSpeakersAndJudges(guild) {
	competition.rounds[competition.rounds.length - 1].forEach(debate => {
		// Let's allocate chair first
		const chair = competition.judges.find(j => { j.name.toLowerCase() === debate.chair.toLowerCase() });
		allocateUserToRoom(guild, chair, `${debate.name} - Debate Room`);
		if (debate.panel.length > 0) {
			// allocate panel if we must
			debate.panel.forEach(j => {
				const judgeIdentifier = competition.judges.find(judge => { judge.name.toLowerCase() === j.name.toLowerCase() });
				allocateUserToRoom(guild, judgeIdentifier, `${debate.name} - Debate Room`)
			});
		}
		
		debate.teams.forEach(t => {
			assignTeamToRoom(guild, t.name, "debate")
		});
		
	});
	console.log("Prep time over");
}

function runTeamDraw(guild, msg) {
	competition.rounds[competition.rounds.length - 1].forEach(debate => {
		if (!(competition.venues.includes(debate.venue))) {
			createDebatingRoom(guild, debate.venue);
			competition.venues.push(debate.venue);
		}
		const positions = ["OG", "OO", "CG", "CO"];
		for (let i = 0; i < positions.length; i++ ) {
			assignTeamToRoom(guild, debate.teams[i], debate.venue, positions[i]);
			console.log(`Trying to assign ${debate.teams[i]} to ${positions[i]} in ${debate.venue}`);
		}
	});
	comp_status = "prep";
	prep_start = new Date();
	setTimeout(() => { timeElapsed(5) }, 300000, "5minElapsed");
	setTimeout(() => { timeElapsed(10) }, 600000, "10minElapsed");
	setTimeout(() => { timeElapsed(13) }, 780000, "13minElapsed");
	setTimeout(() => { timeElapsed(13) }, 840000, "14minElapsed");
	setTimeout(() => { allocateAllSpeakersAndJudges(guild) }, 900000, "prepTimeFinishes");
}

function timeElapsed(mins, msg) {
	const announceChannel = msg.guild.channels.cache.find(channel => channel.name === "announcements");
	announceChannel.send(`@everyone You have ${15 - mins} minute(s) remaining of preparation time.`);
}

function prepTimeLeft(msg) {
	if (comp_status !== "prep") {
		msg.reply("You must be in prep time.");
	} else {
		const now = new Date();
		const difference = 900000 - (now - prep_start);
		if (difference <= 900000) {
			msg.reply(`Prep time has around ${Math.floor(difference/(1000*60))} minutes left. (${difference}ms)`);
		} else {
			msg.reply("Prep time is over!");
		}
	}
}

function revertTeamDraw(guild, msg) {
	competition.rounds[competition.rounds.length - 1].forEach(debate => {
		deleteCategory(guild, debate.venue, msg);
	});
	competition.venues = [];
}

function checkin(msg) {
	const sourceID = msg.member.id;
	if (doesUserHaveRole(msg.member, "Judge")) {
		// Judge
		for (let i = 0; i < competition.judges.length; i++ ) {
			if (competition.judges[i].id === sourceID) {
				// MATCH YAY
				if (competition.judges[i].checkedin === true) {
					msg.reply(`${competition.judges[i].name} is already checked in!`);
				} else {
					competition.judges[i].checkedin = true;
					msg.reply(`${competition.judges[i].name} has been checked in.`);
				}
			}
		}
	} else {
		// Team - ugh
		for (let i = 0; i < competition.teams.length; i++ ) {
			if (competition.teams[i].speakers.includes(sourceID)) {
				// MATCH YAY
				if (competition.teams[i].checkedin === true) {
					msg.reply(`${competition.teams[i].name} is already checked in!`);
				} else {
					competition.teams[i].checkedin = true;
					msg.reply(`${competition.teams[i].name} has been checked in.`);
				}
			}
		}
	}
}

function openCheckin(msg) {
	for (let i = 0; i < competition.judges.length; i++ ) {
		competition.judges[i].checkedin = false;
	}
	for (let i = 0; i < competition.teams.length; i++ ) {
		competition.teams[i].checkedin = false;
	}
	
	comp_status = "check-in";
	msg.reply("CheckIn opened ");
}

function checkinSummary(msg) {
	const x = competition.judges.filter(j => j.checkedin !== false).length;
	const y = competition.teams.filter(t => t.checkedin !== false).length;
	msg.reply(`CheckIn: ${x}/${competition.judges.length} judges on discord, ${y}/${competition.teams.length} teams on discord checked in.`);
}

function checkinDetailed(msg, type) {
	const srchArr = type === "judge" ? competition.judges : competition.teams;
	const missing = srchArr.filter(t => t.checkedin !== true);
	if (missing.length !== 0) {
		let msgO = [];
		missing.forEach(m => {
			msgO.push(m.name);
		});
		msg.reply(`CheckIn: Missing ${type}s: ${msgO.join(", ")}!`);
	} else {
		msg.reply(`CheckIn: No ${type}s missing!`);
	}
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
	if (msg.content.substring(0,1) == "!") {
		const command = msg.content.split(" ");
		switch(command[0]) {
			case "!help":
				helpCommand(msg);
				break;
			case "!prepleft":
				prepTimeLeft(msg);
				break;
			case "!register":
				if (command.length == 1) {
					msg.reply("You need to supply a name")
				} else if (command[command.length - 1].toLowerCase() !== "speaker" && command[command.length - 1].toLowerCase() !== "judge") {
					msg.reply("You must specify if you are a Judge or a Speaker!");
				} else {
					registerUser(msg, command.slice(1, command.length - 1), command[command.length - 1]);
				}
				break;
			case "!team":
				if (command.length <= 2) {
					msg.reply("You need to supply a team name");
				} else if (msg.mentions.members === undefined) {
					msg.reply("You must mention your teammate by placing the @ symbol before their name");
				} else {
					registerTeam(msg, command.slice(2));
				}
				break;
			case "!disband":
				isAuthorised(msg.member, "On Team", true).then(auth => {
					if (auth) {
						unregisterTeam(msg);
					} else {
						msg.reply("You must be on a team to disband it.");
					}
				});
				break;
			case "!checkin":
				if (comp_status === "check-in") {
					isAuthorised(msg.member, "On Team", true).then(auth => {
						if (auth) {
							checkin(msg);
						} else {
							isAuthorised(msg.member, "Judge", true).then(auth => {
								if (auth) {
									checkin(msg);
								} else {
									msg.reply("You must be on a team or be a judge to check in.");
								}
							});
						}
					});
				} else {
					msg.reply("CheckIn is not currently open.");
				}
				break;
			case "!allocate":
				if (command.length <= 2) {
					msg.reply("You must supply a user, and a room");
				} else {
					isAuthorised(msg.member, "Convenor", true).then(auth => {
						if (auth) {
							allocateUserToRoom(msg.guild, msg.mentions.members.first().id, command.splice(2).join(" "), msg);
						} else {
							msg.reply(`Only convenors can use this command.`);
						}
					});
				}
				break;
			case "!venue":
				isAuthorised(msg.member, "Convenor", true).then(auth => {
					if (auth) {
						const venuename = command.splice(1).join(" ");
						createDebatingRoom(msg.guild, venuename);
						msg.reply(`I've created ${venuename}`);
					} else {
						msg.reply(`Only convenors can use this command.`);
					}
				});
				break;
			case "!delvenue":
				isAuthorised(msg.member, "Convenor", true).then(auth => {
					if (auth) {
						const venuename = command.splice(1).join(" ");
						deleteCategory(msg.guild, venuename, msg);
					} else {
						msg.reply(`Only convenors can use this command.`);
					}
				});
				break;
			case "!readdraw":
				isAuthorised(msg.member, "Convenor", true).then(auth => {
					if (auth) {
						getAndReadDraw(msg);
					} else {
						msg.reply(`Only convenors can use this command.`);
					}
				});
				break;
			case "!run-team-draw":
				isAuthorised(msg.member, "Convenor", true).then(auth => {
					if (auth) {
						runTeamDraw(msg.guild, msg);
					} else {
						msg.reply(`Only convenors can use this command.`);
					}
				});
				break;
			case "!revert-team-draw":
				isAuthorised(msg.member, "Convenor", true).then(auth => {
					if (auth) {
						revertTeamDraw(msg.guild, msg);
					} else {
						msg.reply(`Only convenors can use this command.`);
					}
				});
				break;
			case "!readreg":
				isAuthorised(msg.member, "Convenor", true).then(auth => {
					if (auth) {
						processRegData(msg);
					} else {
						msg.reply(`Only convenors can use this command.`);
					}
				});
				break;
			case "!opencheckin":
				isAuthorised(msg.member, "Convenor", true).then(auth => {
					if (auth) {
						openCheckin(msg);
					} else {
						msg.reply(`Only convenors can use this command.`);
					}
				});
				break;
			case "!checkinsum":
				isAuthorised(msg.member, "Convenor", true).then(auth => {
					if (auth) {
						checkinSummary(msg);
					} else {
						msg.reply(`Only convenors can use this command.`);
					}
				});
				break;
			case "!checkindet":
				isAuthorised(msg.member, "Convenor", true).then(auth => {
					if (auth) {
						const validOptions = ["judge", "speaker"];
						if (validOptions.includes(command[1].toLowerCase())) {
							checkinDetailed(msg, command[1].toLowerCase());
						} else {
							msg.reply("You must include a type to return (Judge/Speaker)!");
						}
					} else {
						msg.reply(`Only convenors can use this command.`);
					}
				});
				break;
		}
	}
});