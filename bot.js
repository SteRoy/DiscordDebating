const Discord = require('discord.js');
const client = new Discord.Client();

const token = "";

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
			}
		);
	
	msg.reply(embedMessage);
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
	if (msg.content.substring(0,1) == "!") {
		switch(msg.content) {
			case "!help":
				helpCommand(msg);
				break;
		}
	}
});

client.login(token);