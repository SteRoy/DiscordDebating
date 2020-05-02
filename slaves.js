const Discord = require('discord.js');

class SlaveBot {
	constructor(token, cbWhenReady, competition) {
		this.client = new Discord.Client();
		this.client.login(token);
		this.competition = competition;

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
			this.client.users.fetch(userID).then(slaveUser => {
				// May not be online
				if (typeof(slaveUser) !== undefined) {
					if (typeof (slaveUser.presence) !== undefined && slaveUser.presence.member.voice.channel !== null) {
						slaveUser.presence.member.voice.channel.setChannel(newChannel);
					} else {
						console.log(`${user.nickname} is not in a voice channel - ${newChannel.name}`);
					}
				} else {
					console.log(`Could not assign ${user.name}!`)
				}
			});
		}
	}
	
	handleRoom(room, guild) {
		for (let i = 1; i < 4; i++) {
			const team = this.competition.teams.find(t => t.name.toLowerCase() === room.teams[i].toLowerCase());
			team.speakers.forEach(sID => {
				this.allocateUserToRoom(guild, sID, `${room.venue} - Debate Room`);
			});
		}
	}
}

module.exports = SlaveBot;