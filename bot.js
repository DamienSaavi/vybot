const { Client } = require('discord.js')
const ytdl = require('ytdl-core')
const youtube = require('scrape-youtube').default
const fs = require('fs')
const Queue = require('./queue.js')
require('dotenv').config()

const bot = new Client()

const servers = {}

const PREFIX = '.';
const urlregex = RegExp('youtube\.com|youtu\.be', 'i')
const param_separator = RegExp("\\s+")

const DISC_KEY = process.env.DISC_KEY


bot.on('ready', () => {
    console.log(`Listening d( '-' )b`)
    bot.user.setActivity('.help')
})

bot.on('message', msg => {
    try {
        // extract relevant data from message
        const message = {
            content: msg.content,
            guild: msg.guild,
            member: msg.member,
            channel: msg.channel,
            author: msg.author
        }

        // extract server ID
        const serverID = message.guild.id


        // if not present, add server ID to memory
        if (!servers[serverID])
            servers[serverID] = {
                queue: new Queue(),
                tui: null,
                volume: 0.2
            }

        // extract server obj, argument, and parameters from message
        const server = servers[serverID]
        const args = message.content.substring(1).split(param_separator)
        const op = args[0]
        const params = args.slice(1)

        if (server.tui) {
            // if message was not sent in lounge, ignore
            if (message.channel.id !== server.tui.channel.id)
                return
            // if message is not a command, delete and ignore
            else if (message.content[0] !== PREFIX) {
                msg.delete()
                return
            }
            // if not command setup/help command in case TUI doesn't exist, ignore
        } else if (message.content[0] !== PREFIX || (op !== 'setup' && op !== 'help')) {
            return
        }

        // execute command
        switch (op) {
            case 'play': case 'pl':
                playCommand(params, server, message)
                break
            case 'pause': case 'p':
                pauseCommand(server, message)
                break
            case 'skip': case 'sk':
                skipCommand(params[0], server, message)
                break
            case 'stop': case 'st':
                stopCommand(server, message)
                break
            case 'shuffle': case 'sh':
                shuffleCommand(server, message)
                break
            case 'repeat': case 'rp':
                repeatCommand(server, message)
                break
            case 'volume': case 'vol': case 'v':
                volumeCommand(server, params[0], message)
                break
            case 'queue': case 'q': case 'playlist': case 'list': case 'setup':
                queueCommand(server, message)
                break
            case 'delete': case 'remove': case 'rem': case 'del':
                deleteCommand(params, server, message)
                break
            case 'kill':
                killCommand(server, message)
                break
            case 'help': case 'h':
                helpCommand(message)
                break
        }

        msg.delete()

    } catch (e) {
        console.log(e)
    }
})


function playCommand(params, server, message) {
    if (params.length === 0 || !message.member.voice.channel)
        return

    addVideo(params, server, message)
}

function pauseCommand(server, message) {
    if (server.queue.length !== 0) {
        server.queue.paused = !server.queue.paused

        if (!server.queue.paused)
            server.dispatcher.resume()
        else
            server.dispatcher.pause()

        queueCommand(server, message)
    }
}

function skipCommand(param = '0', server, message) {
    let i = parseInt(param) - 1

    while (i > 0) {
        if (!server.queue.isLooping)
            server.queue.delete(1)
        else
            server.queue.next()
        i--
    }

    if (server.dispatcher)
        server.dispatcher.end()
}

function stopCommand(server, message) {
    server.queue.clear()
    if (message.member.voice.channel) {
        message.member.voice.channel.leave();
        server.queue.paused = true
    }
    queueCommand(server, message)
}

function shuffleCommand(server, message) {
    server.queue.shuffle()
    queueCommand(server, message)
}

function repeatCommand(server, message) {
    server.queue.loop()
    queueCommand(server, message)
}

function volumeCommand(server, param, message) {
    param = parseInt(param)
    if (param < 1)
        param = 1
    else if (param > 10)
        param = 10

    server.volume = param / 10
    if (server.dispatcher)
        server.dispatcher.setVolume(server.volume)

    queueCommand(server, message)
}

// setup TUI and display current queue
function queueCommand(server, message) {
    let qList = ''
    if (server.queue.length === 0) {
        qList = 'Kinda quiet here...'
    } else {
        const list = server.queue.content();
        qList = ' ♫  ' + list[0].title + '\n'
        for (let i = 1; i < list.length; i++) {
            qList += `+${i}  ` + list[i].title + '\n'
        }
    }

    // let stats = ':speaker: ' + '█'.repeat(Math.floor(server.volume*10)/2) + '■'.repeat(Math.floor(10-server.volume*10)/2)
    let stats = ':speaker: ' + server.volume * 10 + '/10'
    stats += (server.queue.paused) ? '\t\t:pause_button:' : '\t\t:arrow_forward:'
    stats += (server.queue.isLooping) ? '\t\t:repeat:' : ''

    stats = '\n' + stats + '\n'

    qList = '```diff\n' + qList + '```'

    if (server.tui) {
        server.tui.edit(`Now playing:` + qList + stats)
            .catch(err => console.log(err))
    } else {
        message.channel.send(`Now playing:` + qList + stats)
            .then(res => server.tui = res)
            .catch(err => console.log(err))
    }
}

function deleteCommand(params = '1', server, message) {

    let targets = params.map(e => parseInt(e)).sort()

    for (let i = 0; i < targets.length; i++)
        targets[i] -= i

    targets.forEach(i => server.queue.delete(i))

    queueCommand(server, message)
}

function addVideo(params, server, message) {
    const queries = []
    let query = ''

    // parse and push each keyphrase separated by '&&'
    for (let i = 0; i < params.length; i++) {
        if (params[i] === '&&') {
            if (query !== '') {
                queries.push(query)
                query = ''
            } continue
        } else if (params[i] !== ' ')
            query += params[i] + ' '

        if (i === params.length - 1 && query !== '')
            queries.push(query)
    }

    // look for each query and if found, store name and URL in playlist
    for (let i = 0; i < queries.length; i++) {
        findVideo(queries[i])
            .then(response => {
                if (response) {
                    server.queue.add(response.url, response.title)
                    if (!bot.voice.connections.some(conn => conn.channel.id == message.member.voice.channel.id)) {
                        message.member.voice.channel.join()
                            .then(connection => play(connection, server, message))
                            .catch(err => console.log(err))
                    }
                    queueCommand(server, message)
                }
            })
            .catch(err => console.log(err))
    }
}

function play(connection, server, message) {
    server.dispatcher = connection.play(
        ytdl(server.queue.current), {
        filter: 'audioonly',
        quality: 'lowestaudio',
        highWaterMark: 50,
        volume: server.volume
    })

    server.queue.paused = false

    server.dispatcher.on('finish', () => {
        server.queue.next()
        if (server.queue.current) {
            play(connection, server, message)
        }
        else {
            connection.disconnect();
            message.member.voice.channel.leave()
            server.queue.paused = true
            queueCommand(server, message)
        }
    })
    queueCommand(server, message)

    server.dispatcher.on('error', (err) => console.error(err));
}

async function findVideo(query) {
    let result = null

    if (urlregex.test(query)) {
        await youtube.search(query, { type: 'video' })
            .then(results => {
                result = {
                    url: query,
                    title: results.videos[0].title.slice(0, 36)
                }
            })
            .catch(err => console.log(err))
    } else {
        await youtube.search(query, { type: 'video' })
            .then(results => {
                if (results.videos.length > 0)
                    result = {
                        url: results.videos[0].link,
                        title: results.videos[0].title.slice(0, 36)
                    }
                else
                    result = null
            })
            .catch(err => console.log(err))
    }

    return result
}

function helpCommand(message) {
    fs.readFile("./help.txt", "utf8", (err, data) => {
        if (!err)
            message.author.send(data)
                .catch(err => console.log(err))
    })
}

function killCommand(server, message) {
    server.queue.clear()
    if (message.member.voice.channel) {
        message.member.voice.channel.leave();
        server.queue.paused = true
    }

    server.tui.delete()
        .then(res => server.tui = null)
}

bot.login(DISC_KEY)