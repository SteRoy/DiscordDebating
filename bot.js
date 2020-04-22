const Discord = require('discord.js');
const fs = require('fs');
const client = new Discord.Client();

const token = "";

var competition;
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
				name: "Chair Judge Commands", value: "None"
			},
			{
				name: "Tab Commands", value: "None"
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
			targetGM.setNickname(fullname).catch(console.error);
			targetGM.roles.add(speakerRole).catch(console.error);
			msg.reply(`Registered ${fullname} as a ${roleName}.`);
			storeJudge(targetGM, fullname);
		});
	} else {
		msg.reply("You have already registered!");
	}
}

function storeTeam(speakerOne, speakerTwo, teamName) {
	competition.teams.push({name: teamName, speakers: [speakerOne.id, speakerTwo.id]});
	saveToFile();
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

function allocateUserToRoom(guild, userID, channelName, msg) {
	const newChannel = getChannelByName(guild, channelName);
	console.log(newChannel);
	if (typeof(newChannel) === typeof(undefined)) {
		msg.reply(`You must specify a valid channel`);
	} else {
		guild.members.fetch(userID).then(user => {
			if (user.voice.channel !== null){
				user.voice.setChannel(newChannel);
				msg.reply("Allocated");
			} else {
				console.log(`${user.nickname} is not in a voice channel - ${newChannel.name}`);
			}
		});
	}
}

function debugAllocater(msg) {
	allocateUserToRoom(msg.guild, msg.member.id, "Room #1");
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
		}
	}
});

client.login(token);