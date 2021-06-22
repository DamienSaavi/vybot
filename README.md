# README

### Description
Discord music bot with extensive features:
* Create playlists using keywords or Youtube links
* Shuffle and modify songs
* Text-based UI
* Various playback features

### How to use
Add the bot to your server:
https://discord.com/api/oauth2/authorize?client_id=679935364030660646&permissions=3155968&scope=bot

Create a separate text channel for VyBot and type the .setup command in it.
If done succesfully, an empty playlist should appear in the channel. VyBot will only accept commands from that channel after setup.

Use the .help command or see the help.txt in this repo for a full set of available commands and setup instructions.

### Bugs & limitations
I have not been able to test the bot while active in multiple servers yet so unknown bugs related to that are probable.

Since the app uses scrapers, some changes in youtube's API may cause issues and an update for dependencies may be needed before the bot can function again.

Audio stream may be choppy at times. This is probably due to server connection quality as testing locally yields much more stable audio quality. Migrating to another platform in the future may mitigate this issue.

Since cloud playlist storage hasn't been implemented yet, on server-side instance reset, all playlists and voice connectections will be lost and the bot needs to be setup again. This happens often since free-tier Heroku apps go to sleep during inactivity.

If you encounter any bugs or issues using this bot I'd be very happy to know about them.

### TODO
- [ ] Switch playlist impl to JS array from linked list
- [ ] Implement MongoDB for server & playlist storage
- [ ] Use embed message for playlist display

### Done
- [x] Update APIs and packages