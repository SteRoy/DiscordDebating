const Discord = require('discord.js');
const fs = require('fs');
const spawn = require("child_process").spawn;
const client = new Discord.Client();

// TODO: remember to put the saveToFiles() back into the readreg and readdraw commands

const defaultTournament = {"teams":[],"venues":[],"judges":[],"speakers": [], "rounds":[],"regdata":{"teams":[],"judges":[], "speakers": [], "childrenJ": [], "childrenS": []}};

let token;
let tournament_url;
let sessionid;
let csrftoken;

let comp_status;
let prep_start;

let motion = "";
let infoslide = "";


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

function resetComp() {
	competition = Object.assign(competition, defaultTournament);
	console.log("Resetting Tournament");
	saveToFile();
	
	// TODO: strip everybody of Judge/Speaker roles.
}

function isAuthorised(user, level, exclusive) {
	if (exclusive) {
		return doesUserHaveRole(user, level).then(res => {
			return res;
		});
	} else {
		getRoleByName(user.guild.roles, level).then(role => {
			if (highestRole.comparePositionTo(role) >= 0) {
				return true;
			}
		});
	}
	return false;
}

function doesUserHaveRole(user, roleName) {
	return getRoleByName(user.guild.roles, roleName).then(roleID => {
			if (user.roles.cache.has(roleID.id)) {
				return true;
			} else {
				return false;
			}
	});
}

function getRoleByName(rm, name) {
	return rm.fetch().then(roles => roles.cache.find( role => role.name === name ));
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
				name: "Judge Commands", value: "**!checkin** - Check yourself in \n **!prepleft** - Notifies you of the amount of preperation time remaining \n **!discuss** - [CHAIR ONLY] allocates you and your panel to your judge room for deliberation. \n **!enddiscuss** - [CHAIR ONLY] allocates you and your panel back to the debate room (post deliberation)."
			},
			{
				name: "Tab Commands", value: "**!motion** <Motion> - Set the current round motion afte reading draw \n **!infoslide** <Infoslide> - After reading the draw, set the current round info slide \n **!cancelmotion** - Stops the automatic release of motion after allocations (60s grace period post-allocation) \n **!readreg** - Read the registered team csvs into memory \n **!readdraw** - Read the draw from tab \n **!run-team-draw** - Create debating venues and allocate teams \n **!venue** <Name> - Manually create a debating venue \n **!delvenue** <Name> - Delete a debating venue \n **!allocate** <@Name> <Room> - Manually allocate a person to a voice channel"
			},
			{
				name: "Speaker Commands", value: "**!register** <Your Name> <Speaker/Judge> - register yourself as a Speaker"
			},
			{
				name: "Team Commands", value: "**!prepleft** - Notifies you of the amount of preparation time remaining \n **!team** <@Teammate> <Team Name> - register a team with your teammate. \n **!disband** - disbands your current team. \n **!checkin** - check in your team."
			}
		);
	
	msg.reply(embedMessage);
}

function registerUser(msg, name, type) {
	const fullname = name.join(" ");
	const targetGM = msg.member;
	const roleName = (type.toLowerCase() == "speaker" ? "Speaker" : "Judge");
	if (competition.regdata.judges.length > 0 && competition.regdata.teams.length > 0) {
		if (typeof(competition.judges.find(j => j.id === targetGM.id)) === typeof(undefined) && (typeof(competition.speakers.find(s => s.id === targetGM.id)) === typeof(undefined))) {
			if (typeof(competition.judges.find(j => j.name === fullname.toLowerCase())) === typeof(undefined) && (typeof(competition.speakers.find(s => s.name === fullname.toLowerCase())) === typeof(undefined))) {
				getRoleByName(msg.guild.roles, roleName).then(speakerRole => {
					let srchArr;
					if (roleName === "Judge") {
						srchArr = competition.regdata.judges;
					} else {
						srchArr = competition.regdata.speakers;
					}
				
					if (srchArr.includes(fullname.toLowerCase())) {
						storeRegistration(targetGM, fullname, roleName);
					} else {
						msg.reply(`This ${roleName} doesn't exist in the pre-reg database!`);
						return false;
					}
					
					const safeguardRoleSearch = (roleName == "Speaker" ? competition.regdata.childrenS : competition.regdata.childrenJ);
					const indexOfEntry = srchArr.indexOf(fullname.toLowerCase());
					
					getRoleByName(msg.guild.roles, (safeguardRoleSearch[indexOfEntry] ? "Schools" : "Adult")).then(safeguardRole => {
						targetGM.roles.add([speakerRole, safeguardRole]).catch(console.error);
						targetGM.setNickname(fullname).catch(console.error);
						msg.reply(`Registered ${fullname} as a ${roleName} (${safeguardRole.name}).`);
					});

				});
			} else {
				msg.reply(`${fullname} is already registered on discord!`);
			}
		} else {
			msg.reply("You have already registered!");
		}
	} else {
		msg.reply("Registration data hasn't been imported yet!");
	}
}

function registrationSummary(msg) {
	msg.reply(`!register: ${competition.judges.length}/${competition.regdata.judges.length} judges, ${competition.teams.length}/${competition.regdata.teams.length} teams, ${competition.speakers.length}/${competition.regdata.speakers.length} speakers on discord registered on discord.`);
}

function registrationDetailed(msg, type) {
	const srchArrRegistered = type === "judge" ? competition.judges : competition.teams;
	const srchArrRaw = type === "judge" ? competition.regdata.judges : competition.regdata.teams;

	let missing = [];
	srchArrRaw.forEach(entry => {
		if ( ( typeof(srchArrRegistered.find(r => r.name.toLowerCase() === entry)) === typeof(undefined) ) ) {
			missing.push(entry);
		}
	});
	
	if (missing.length !== 0) {
		let msgO = [];
		missing.forEach(m => {
			msgO.push(m);
		});
		msg.reply(`!register: Missing ${type}s: \n ${msgO.join(", \n")}`);
	} else {
		msg.reply(`!register: No ${type}s missing!`);
	}
}

function storeTeam(speakerOne, speakerTwo, teamName) {
	competition.teams.push({name: teamName.toLowerCase(), speakers: [speakerOne.id, speakerTwo.id], checkedin: false});
	saveToFile();
}

function findSpeakersForTeamByName(name) {
	return competition.teams.find(team => team.name == name.toLowerCase() ).speakers;
}

function storeRegistration(adj, fname, role) {
	if (role === "Judge") {
		competition.judges.push({name: fname.toLowerCase(), id: adj.id, checkedin: false});
	} else {
		competition.speakers.push({name: fname.toLowerCase(), id: adj.id});
	}
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
			if (speakerOne.roles.cache.has(speakerRole.id) && speakerTwo.roles.cache.has(speakerRole.id)) {
				if (competition.regdata.teams.includes(teamname.toLowerCase())) {
					getRoleByName(msg.guild.roles, "On Team").then(teamRole => {
						if (speakerOne.roles.cache.has(teamRole.id) || speakerTwo.roles.cache.has(teamRole.id)) {
							msg.reply("You have already registered a team.");
						} else {
							storeTeam(speakerOne, speakerTwo, teamname);
							speakerOne.roles.add(teamRole).catch(console.error);
							speakerTwo.roles.add(teamRole).catch(console.error);
							speakerOne.setNickname(`[${teamname}] ${speakerOne.nickname.split("] ").pop()}`.substring(0,32));
							speakerTwo.setNickname(`[${teamname}] ${speakerTwo.nickname.split("] ").pop()}`.substring(0,32));
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

function createAllDrawVenues(msg) {
	competition.rounds[competition.rounds.length - 1].forEach(debate => {
		createDebatingRoom(msg.guild, debate.venue);
	});
	msg.reply("Done");
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
	if (typeof(newChannel) === typeof(undefined)) {
		console.log(`Invalid assignment channel specified for ${userID} - ${channelName}`);
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
	console.log(teamName);
	const team = competition.teams.find(t => t.name.toLowerCase() === teamName.toLowerCase());
	if (typeof(team) !== typeof(undefined)) {
		team.speakers.forEach(s => {
			if (pos !== "debate") {
				allocateUserToRoom(guild, s, `${pos} - Prep Room [${roomName}]`);
			} else {
				allocateUserToRoom(guild, s, `${roomName} - Debate Room`);
			}
		});
	} else {
		console.log(`${teamName} is undefined.`);
	}
}

function getAndReadDraw(msg) {
	const current_round = competition.rounds.length + 1;
	const python = spawn('python', ['draw-processor.py', tournament_url, sessionid, csrftoken, current_round]);
	
	python.stdout.on('close', (err) => {
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
			motion = "";
			infoslide = "";
			saveToFile();
		});
	});
}

function processRegData(msg) {
	const python = spawn('python', ['csv-processor.py']);
	python.stdout.on('close', (err) => {
		fs.readFile('regdata.json', (err, data) => {
			const x = JSON.parse(data);
			competition.regdata = x;
			msg.reply(`Loaded ${competition.regdata.teams.length} registered teams, ${competition.regdata.judges.length} registered judges!`);
			saveToFile();
		});
	});
}

function allocateAllSpeakersAndJudges(guild) {
	competition.rounds[competition.rounds.length - 1].forEach(debate => {
		let toAllocate = [];
		const chair = competition.judges.find(j => j.name.toLowerCase() === debate.chair.toLowerCase());
		toAllocate.push(chair);
		
		if (debate.panel.length > 0) {
			// allocate panel if we must
			debate.panel.forEach(j => {
				const judge = competition.judges.find(judge => judge.name.toLowerCase() === j.toLowerCase());
				toAllocate.push(judge);
			});
		}
		
		
		toAllocate.forEach(allocation => {
			if (typeof(allocation) !== typeof(undefined)) {
				allocateUserToRoom(guild, allocation.id, `${debate.venue} - Debate Room`);
			}
		});
		
		console.log(debate.teams);
		debate.teams.forEach(t => {
			assignTeamToRoom(guild, t, `${debate.venue}`, "debate");
		});
		
	});
	console.log("Prep time over");
}

function runTeamDraw(guild, msg) {
	competition.rounds[competition.rounds.length - 1].forEach(debate => {
		const positions = ["OG", "OO", "CG", "CO"];
		for (let i = 0; i < positions.length; i++ ) {
			assignTeamToRoom(guild, debate.teams[i], debate.venue, positions[i]);
			console.log(`Trying to assign ${debate.teams[i]} to ${positions[i]} in ${debate.venue}`);
		}
	});
}

function releaseInfoslideAndMotionProcessor(msg) {
	const announceChannel = msg.guild.channels.cache.find(channel => channel.name === "announcements");
	if (infoslide !== "") {
		announceChannel.send(`@everyone, This round has an infoslide: ${infoslide}. The motion will be announced in 60 seconds.`);
		setTimeout(() => { sendMotion(msg) }, 6000, "motionRelease");
	} else {
		sendMotion(msg);
	}
}

function sendMotion(msg) {
	const announceChannel = msg.guild.channels.cache.find(channel => channel.name === "announcements");
	announceChannel.send(`@everyone, The motion for this round reads: ${motion}`);
	
	setTimeout(() => { timeElapsed(5, msg) }, 300000, "5minElapsed");
	setTimeout(() => { timeElapsed(10, msg) }, 600000, "10minElapsed");
	setTimeout(() => { timeElapsed(13, msg) }, 780000, "13minElapsed");
	setTimeout(() => { timeElapsed(14, msg) }, 840000, "14minElapsed");
	setTimeout(() => { allocateAllSpeakersAndJudges(msg.guild) }, 900000, "prepTimeFinishes");
}

function stopMotionRelease() {
	clearTimeout("motionRelease");
}

function timeElapsed(mins, msg) {
	const announceChannel = msg.guild.channels.cache.find(channel => channel.name === "announcements");
	announceChannel.send(`@everyone You have ${15 - mins} minute(s) remaining of preparation time.`);
}

function setMotion(msg, motionText) {
	motion = motionText;
	msg.reply(`Motion: ${motion}`);
}

function setInfo(msg, infoText) {
	infoslide = infoText;
	msg.reply(`InfoSlide: ${infoslide}`);
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
	doesUserHaveRole(msg.member, "Judge").then(auth => {
		if (auth) {
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
					return;
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
					return;
				}
			}
		}
	});
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

function chairMoveJudges(msg, chairID, start) {
	const chair = competition.judges.find(j => j.id === chairID);
	const room = competition.rounds[competition.rounds.length - 1].find(v => v.chair.toLowerCase() === chair.name.toLowerCase() );
	let toAllocate = [];
	
	if (typeof(room) !== typeof(undefined)) {
		toAllocate.push(chair);
		room.panel.forEach(judge => {
			toAllocate.push(competition.judges.find(a => a.name.toLowerCase() === judge.toLowerCase()))
		});
		
	} else {
		msg.reply("You must be a chair to use this command.");
	}
	
	toAllocate.forEach(allocation => {
		if (typeof(allocation) !== typeof(undefined)) {
			let debateOrJudges = start ? `Judges` : `Debate`;
			allocateUserToRoom(msg.guild, allocation.id, `${room.venue} - ${debateOrJudges} Room`);
		}
	});
	
}

function prepareForAnnouncements(guild) {
	competition.judges.forEach(judge => {
		const judgeID = judge.id;
		guild.members.fetch(judgeID).then(judgeGM => {
			doesUserHaveRole(judgeGM, "CA").then(ca => {
				doesUserHaveRole(judgeGM, "Equity").then(equity => {
					doesUserHaveRole(judgeGM, "Convenor").then(con => {
						if (!(ca || equity || con)) {
							allocateUserToRoom(guild, judgeID, "Voice Announcements")
						}
					});
				});
			});
		});
	});
	
	competition.teams.forEach(team => {
		team.speakers.forEach(speakerID => {
			allocateUserToRoom(guild, speakerID, "Voice Announcements");
		});
	});
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
					registerTeam(msg, command.slice(2).replace("  ", " "));
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
			case "!discuss":
				isAuthorised(msg.member, "Judge", true).then(auth => {
					if (auth) {
						chairMoveJudges(msg, msg.member.id, true);
					} else {
						msg.reply("You must be a chair judge to use this command.");
					}
				});
				break;
			case "!enddiscuss":
				isAuthorised(msg.member, "Judge", true).then(auth => {
					if (auth) {
						chairMoveJudges(msg, msg.member.id, false);
					} else {
						msg.reply("You must be a chair judge to use this command.");
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
			case "!announce":
				isAuthorised(msg.member, "Convenor", true).then(auth => {
					if (auth) {
						prepareForAnnouncements(msg.guild);
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
			case "!drawvenues":
				isAuthorised(msg.member, "Convenor", true).then(auth => {
					if (auth) {
						createAllDrawVenues(msg);
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
						const validOptions = ["judge", "team"];
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
			case "!regsum":
				isAuthorised(msg.member, "Convenor", true).then(auth => {
					if (competition.regdata.teams.length > 0 && competition.regdata.judges.length > 0) {
						if (auth) {
							registrationSummary(msg);
						} else {
							msg.reply(`Only convenors can use this command.`);
						}
					} else {
						msg.reply("No regdata imported, use !readreg");
					}
				});
				break;
			case "!regdet":
				isAuthorised(msg.member, "Convenor", true).then(auth => {
					if (competition.regdata.teams.length > 0 && competition.regdata.judges.length > 0) {
						if (auth) {
							const validOptions = ["judge", "team"];
							if (validOptions.includes(command[1].toLowerCase())) {
								registrationDetailed(msg, command[1].toLowerCase());
							} else {
								msg.reply("You must include a type to return (Judge/Team)!");
							}
						} else {
							msg.reply(`Only convenors can use this command.`);
						}
					} else {
						msg.reply("No regdata imported, use !readreg");
					}
				});
				break;
			case "!motion":
				isAuthorised(msg.member, "Convenor", true).then(auth => {
					if (auth) {
						if (command.length > 1) {
							setMotion(msg, command.slice(1).join(" "));
						} else {
							msg.reply("You must specify a motion");
						}
					} else {
						msg.reply(`Only convenors can use this command.`);
					}
				});
				break;
			case "!infoslide":
				isAuthorised(msg.member, "Convenor", true).then(auth => {
					if (auth) {
						if (command.length > 1) {
							setInfo(msg, command.slice(1).join(" "));
						} else {
							msg.reply("You must specify an infoslide!");
						}
					} else {
						msg.reply(`Only convenors can use this command.`);
					}
				});
				break;
			case "!releasemotion":
				isAuthorised(msg.member, "Convenor", true).then(auth => {
					if (auth) {
						comp_status = "prep";
						prep_start = new Date();
						setTimeout(() => { releaseInfoslideAndMotionProcessor(msg) }, 6000, "motionRelease");
					} else {
						msg.reply(`Only convenors can use this command.`);
					}
				});
				break;
			case "!cancelmotion":
				isAuthorised(msg.member, "Convenor", true).then(auth => {
					if (auth) {
						stopMotionRelease();
					} else {
						msg.reply(`Only convenors can use this command.`);
					}
				});
				break;
			case "!resettournament":
				isAuthorised(msg.member, "Convenor", true).then(auth => {
					if (auth) {
						const validOptions = ["yes im serious"];
						if (validOptions.includes(command.slice(1).join(" ").toLowerCase())) {
							resetComp();
						} else {
							msg.reply("You must include the confirmation statement (if you don't know what that is, don't use this)!");
						}
					} else {
						msg.reply(`Only convenors can use this command.`);
					}
				});
				break;
		}
	}
});