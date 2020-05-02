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
		const newChannel = guild.channels.cache.find(channel => channel.name === channelName);
		if (typeof(newChannel) === typeof(undefined)) {
			console.log(`Invalid assignment channel specified for ${userID} - ${channelName}`);
		} else {
			this.client.users.fetch(userID).then(slaveUser => {
				// May not be online
				if (typeof(slaveUser) !== undefined) {
					if (typeof(slaveUser.presence) !== undefined && slaveUser.presence.member.voice.channel !== null) {
						slaveUser.presence.member.voice.setChannel(newChannel);
					} else {
						console.log(`${slaveUser.displayName} is not in a voice channel - ${newChannel.name}`);
					}
				} else {
					console.log(`Could not assign ${slaveUser.displayName}!`)
				}
			}).catch(err => {});
		}
	}
	
	updateComp(comp) {
		this.competition = comp;
	}
	
	handleRoom(room, guild) {
		for (let i = 1; i < 4; i++) {
			if (typeof(this.competition) === typeof(undefined)) {
				console.log("ERRORED");
			} else {
				try {
					const team = this.competition.teams.find(t => t.name.toLowerCase() === room.teams[i].toLowerCase());
					team.speakers.forEach(sID => {
						allocateUserToRoom(guild, sID, `${room.venue} - Debate Room`);
					});
				} catch(err) {
				}
			}
		}
	}
	
	handlePrep(room, guild) {
		const positions = ["OG", "OO", "CG", "CO"];
		if (typeof(this.competition) === typeof(undefined)) {
			console.log(`Errored in room ${room.venue}`);
		} else {
			for (let i = 0; i < 4; i++) {
				const team = this.competition.teams.find(t => t.name.toLowerCase() === room.teams[i].toLowerCase());
				team.speakers.forEach(sID => {
					const roomname = i === 0 ? `${room.venue} - Debate Room` : `${positions[i]} - Prep Room [${room.venue}]`;
					this.allocateUserToRoom(guild, sID, roomname);
				});
			}
		}
	}
}

module.exports = SlaveBot;