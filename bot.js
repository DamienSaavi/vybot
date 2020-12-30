const {Client} = require('discord.js')
const Queue = require('./queue.js')
const ytdl = require('ytdl-core')
const fetch = require('node-fetch')
const fs = require('fs')
const bot = new Client()

let servers = []

const PREFIX = '.';
const urlregex = RegExp('youtube\.com|youtu\.be', 'i')
const param_separator = RegExp("\\s+")

const YT_KEY = process.env.YT_KEY
const DISC_KEY = process.env.DISC_KEY


bot.on('ready', () => console.log(`Listening d( '-' )b`))

bot.on('message', msg => {
try {

    const message = {
        content: msg.content,
        guild: msg.guild,
        member: msg.member,
        channel: msg.channel,
        author: msg.author
    }
    
    const serverID = message.guild.id
    
    if (!servers[serverID])
        servers[serverID] = { 
            queue: new Queue(),                
            info_message: null,
            volume: 0.1
        }

    const server = servers[serverID]
    const args = message.content.substring(1).split(param_separator)
    const op = args[0]
    const params = args.slice(1)

    if (server.info_message) {
        if (message.channel.id !== server.info_message.channel.id)
            return
        else if (message.content[0] !== PREFIX) {
            msg.delete()
            return
        }
    } else if (message.content[0] !== PREFIX || (op !== 'setup' && op !== 'help')) {
        return
    }
    
    switch(op) {
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
        case 'volume': case 'vol':
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
    
} catch {
    console.log('oop almost crashed :)')
}
})


function playCommand(params, server, message) {
    if (params.length === 0 || !message.member.voiceChannel)
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

function skipCommand(param='0', server, message) {
    let i = parseInt(param)-1
    
    while(i > 0) {
        if (!server.queue.isLooping)
            server.queue.delete(1)
        else
            server.queue.next()
        i--
    }
    
    if(server.dispatcher)
        server.dispatcher.end()
}

function stopCommand(server, message) {
    server.queue.clear()
    if(message.guild.voiceConnection) {
        message.guild.voiceConnection.disconnect()
        message.member.voiceChannel.leave();
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
    else if (param > 100)
        param = 100

    server.volume = param/100
    server.dispatcher.setVolume(server.volume)

    queueCommand(server, message)
}

function queueCommand(server, message) {
    let qList = ''
    if (server.queue.length === 0) {
            qList = '...'
    } else {
        const list = server.queue.content();
        qList = '\t♫  '+list[0].title+'\n'
        for (let i=1; i<list.length; i++) {
            qList += `+${i}  `+list[i].title+'\n'
        }
    }
    let stats = ':speaker: ' + server.volume*100
    stats +=  (server.queue.paused) ? '\t\t:pause_button:' : '\t\t:arrow_forward:'
    stats += (server.queue.isLooping) ? '\t\t:repeat:' : ''
    
    stats = '\n' + stats + '\n'

    qList = '```diff\n' + qList + '```' 

    if (server.info_message) {
        server.info_message.edit(`Now playing:` + qList + stats)
    } else {
        message.channel.send(`Now playing:` + qList + stats)
        .then(res => server.info_message=res)
        .catch(err => console.log(err))
    }
}

function deleteCommand(params='1', server, message) {
    
    let targets = params.map(e => parseInt(e)).sort()
    
    for (let i=0; i<targets.length; i++)
        targets[i] -= i

    targets.forEach(i => server.queue.delete(i))

    queueCommand(server, message)
}

function addVideo(params, server, message) {
    let queries = []
    let query = ''

    for (let i=0; i<params.length; i++) {
        if (params[i] === '&&') {
            if (query !== '') {
                queries.push(query)
                query = ''
            } continue
        } else if (params[i] !== ' ')
            query += params[i] + '%20'

        if (i === params.length-1 && query !== '')  
            queries.push(query)
    }

    const requests = []

    for (let i=0; i<queries.length; i++) {
        let request = findVideo(queries[i])
        .then(response => {
            if (response !== null) {
                server.queue.add(response.url, response.title)
            }
        })
        .catch(err => console.log(err))
        
        requests.push(request)
    }

    Promise.all(requests)
    .then(ihateithere => {
        if (!message.guild.voiceConnection && server.queue.length > 0) {
            message.member.voiceChannel.join()
            .then(connection => play(connection, server, message))
            .catch(err => console.log(err))
        }
        queueCommand(server, message)
    })
}

function play(connection, server, message) {
    server.dispatcher = connection.playStream(ytdl(server.queue.current, {filter: 'audioonly', quality: 'lowestaudio',highWaterMark: 1<<23}), {volume: server.volume})
    
    server.queue.paused = false

    server.dispatcher.on('end', () => {
        server.queue.next()
        if (server.queue.current){
            play(connection, server, message)
        }
        else {
            connection.disconnect();
            message.member.voiceChannel.leave()
            server.queue.paused = true
            queueCommand(server, message)
        }
    })
    queueCommand(server, message)
}

async function findVideo(query) {
    let result = null
    
    let url = ''
    let title = ''
    
    if (urlregex.test(query))
        {url = query}
    else {
        await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&videoCategoryId=10&type=video&q=${query}&key=${YT_KEY}`)
        .then(res => res.json())
        .then(body => {
            if (body.error) {
                url = ''
                console.log(body.error)
            } else
                url = 'https://youtube.com/watch?v='+body.items[0].id.videoId
        })
        .catch(err => console.log(err))
    }

    if (url !== '') {
        await ytdl.getBasicInfo(url)
        .then(info => title=info.title.slice(0,36))
        .then(res => result = {url: url, title: title})
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
    if(message.guild.voiceConnection) {
        message.guild.voiceConnection.disconnect()
        message.member.voiceChannel.leave();
        server.queue.paused = true
    }

    server.info_message.delete()
    .then(res => server.info_message=null)
}

bot.login(DISC_KEY)