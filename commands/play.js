require('dotenv').config();
const { showOnConsole } = require('./../Utilities.js');
const MusicPlayer = require('./../classes/MusicPlayer.js');
const ReactionButton = require('./../classes/ReactionButton.js');

const YouTube = require("discord-youtube-api");
const youtube = new YouTube(process.env.YOUTUBE_API_KEY);

class Song {
  constructor({ title, url, length, thumbnail }, addedBy) {
    this.title = title;
    this.url = url;
    this.length = length;
    this.thumbnail = thumbnail;
    this.addedBy = addedBy;
  }
  setEmbed (embed) {
    return embed
      .setTitle(this.title)
      .setURL(this.url)
      .setThumbnail(this.thumbnail)
  }
}

module.exports = {
  config: {
    name: 'play',
    aliases: ['p'],
    permissions: ['CONNECT', 'SPEAK'],
    description: 'Starts playing a song from YouTube.',
    usage: '<song-name>',
    args: true,
    cooldown: 4,
    category: 'music'
  },
  async execute (message, args) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message.reply('Lol! You forgot to join a Voice Channel.');
    } else if (message.guild.voiceConnection) {
      return message.reply('I\'m already being used in a Voice Channel!');
    }

    const searchSong = query => new Promise((resolve, reject) => {
      youtube.searchVideos(`${query}, music`)
        .then(video => {
          resolve(new Song(video, message.author));
          message.delete();
        })
        .catch(reject);
    });
    let player = message.client.SERVERS.get(message.guild.id);
    if (args[0] == 'db') return console.log(player.currentSongIndex);
    if (player) {
      if (!isNaN(args[0])) {
        player.currentSongIndex = args[0] - 2;
        player.next(1);
      } else {
        searchSong(args.join(' '))
          .then(song => player.addSong(song))
          .catch(err => showOnConsole('Searching Error:', err, 'error'));
      }
      return;
    }

    player = new MusicPlayer(message.guild.id, message.channel, voiceChannel);
    try {
      player.DJ = await player.textChannel.send(player.embed.setTitle('Starting!'));
      player.voiceConnection = await voiceChannel.join();
    } catch (err) {
      showOnConsole('VC Join:', err, 'error');
      return message.channel.send(err);
    }

    searchSong(args.join(' '))
      .then(song => player.addSong(song))
      .catch(err => showOnConsole('Searching Error:', err, 'error'));

    player.voiceConnection.on('disconnect', () => player.close());
    player.voiceConnection.on('reconnecting', () => console.log('Iam vc reconnetn'));

    const emojies = new Map()
      .set('🇶', () => player.showQueue())
      .set('🔁', () => player.toggleRepeat())
      .set('⏮️', () => player.previous())
      .set('⏯️', () => player.pauseResume())
      .set('⏭️', () => player.next())
      .set('🗑️', () => player.removeSong())
      .set('🛑', () => player.close());

    player.reactionController = new ReactionButton(player.DJ, emojies, () => true);
    message.client.SERVERS.set(message.guild.id, player);
  }
};