const Discord = require('discord.js');
class SlaveBot {
	constructor(token, cbWhenReady) {
		this.client = new Discord.Client();
		this.client.login(token);
		
		this.client.on('ready', () => {
			console.log(`Logged in as ${this.client.user.tag}!`);
			cbWhenReady();
		});
	}
	
	allocateUserToRoom(guild, userID, channelName) {
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
	
	handleRoom(room, guild) {
		for (let i = 1; i < 4; i++) {
			const team = room.teams[i];
			team.speakers.forEach(sID => {
				allocateUserToRoom(guild, sID, `${room.venue} - Debate Room`);
			});
		}
	}
}

module.exports = SlaveBot;