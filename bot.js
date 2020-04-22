const Discord = require('discord.js');
const client = new Discord.Client();

const token = "";

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
				name: "Speaker Commands", value: "**!register** <Your Name> - register yourself as a Speaker"
			},
			{
				name: "Team Commands", value: "None"
			}
		);
	
	msg.reply(embedMessage);
}

function registerSpeaker(msg, name) {
	const fullname = name.join(" ");
	const targetGM = msg.member;
	getRoleByName(msg.guild.roles, "Speaker").then(speakerRole => {
		targetGM.setNickname(fullname).catch(console.error);
		targetGM.roles.add(speakerRole).catch(console.error);
		msg.reply(`Registered ${fullname}`);
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
			case "!register":
				if (command.length == 1) {
					msg.reply("You need to supply a name")
				} else {
					registerSpeaker(msg, command.slice(1));
				}
		}
	}
});

client.login(token);