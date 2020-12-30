const MAX_LENGTH = 20

class Song {
    constructor(url, title, next=null) {
        this.url = url
        this.title = title
        this.next = next
    }
}

module.exports = class Queue {
    constructor() {
        this.head = null
        this.tail = null
        this.length = 0
        this.paused = true
    }

    add(url, title) {
        if (this.length >= MAX_LENGTH)
            return

        let tmp = new Song(url, title)

        if(this.length === 0) {
            this.head = tmp
            this.tail = tmp
        } else {
            tmp.next = this.tail.next
            this.tail.next = tmp
            this.tail = tmp
        }
        
        this.length++
    }

    delete(index=0) {
        if (index < 1 || index >= this.length)
            return
        
        let prev = this.head
        let tmp = prev.next
        
        while (index > 1) {
            tmp = tmp.next
            prev = prev.next
            index--
        }

        prev.next = tmp.next

        if (tmp === this.tail)
            this.tail = prev

        this.length--
    }

    get current() {
        if (this.length === 0)
            return null
        else
            return this.head.url
    }

    next() {
        if (this.length === 0)
            return

        this.head = this.head.next

        if (this.tail.next !== null)
            this.tail = this.tail.next
        else
            this.length--
    }

    skipTo(index) {
        if (this.length === 0)
            return

        while (index > 0)
            this.next()
    }

    shuffle() {
        if (this.length === 0)
            return

        let current = this.head


        for (let i=this.length-1; i>1; i--) {
            let j = Math.floor(Math.random()*(i))
            
            if (j === 0) {
                current = current.next
                continue;
            }
            
            let target = current.next
            let tmp = current
            
            while (j > 0) {
                target = target.next
                tmp = tmp.next
                j--
            }

            tmp.next = target.next
            target.next = current.next
            current.next = target

            if (tmp.next === null || tmp.next === this.head)
                this.tail = tmp

            current = current.next
        }

        if (this.tail.next !== null && this.tail.next !== this.head)
            console.log("SHUFFLE! SOMETHING AINT RIGHT CHIEF")
    }

    clear() {
        this.head = null
        this.tail = null
        this.length = 0
    }

    getInfo(index=0) {
        if (this.length === 0)
            return

        let tmp = this.head

        while(index > 0) {
            tmp = tmp.next
            index--
        }

        return {title: tmp.title, url: tmp.url}    
    }

    content() {
        if (this.length === 0)
            return

        let list = new Array()
        let tmp = this.head

        do {
            list.push({title: tmp.title, url: tmp.url})
            tmp = tmp.next
        } while (tmp !== this.head && tmp !== null)

        return list
    }

    loop() {
        if (this.length === 0)
            return

        if (this.tail.next === null)
            this.tail.next = this.head
        else if (this.tail.next === this.head)
            this.tail.next = null
        else
            console.log(this.tail, `LOOP! SOMETHING IS NOT RIGHT CHIEF`)
    }

    get isEmpty() {
        if (this.length === 0)
            return true
        else
            return false
    }

    get isLooping() {
        if (this.length === 0)
            return

        if (this.tail.next === this.head)
            return true
        else if (this.tail.next === null)
            return false
        else
            console.log(`ISLOOPING! SOMETHING IS NOT RIGHT CHIEF`)
    }
}