const Discord = require('discord.js');
const client = new Discord.Client();

const token = "";

var competition = {teams: [], judges: []};

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
				name: "Team Commands", value: "**!team** <@Teammate> <Team Name> - register a team with your teammate."
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
		});
	} else {
		msg.reply("You have already registered!");
	}
}

function storeTeam(speakerOne, speakerTwo, teamName) {
	competition.teams.push({name: teamName, speakers: [speakerOne.id, speakerTwo.id]});
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
				if (isAuthorised(msg.member, "On Team", true)) {
					unregisterTeam(msg);
				} else {
					msg.reply("You must be on a team to disband it.");
				}
				break;
		}
	}
});

client.login(token);