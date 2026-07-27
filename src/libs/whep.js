/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-prototype-builtins */

const Extensions = {
  Core: {
    ServerSentEvents: 'urn:ietf:params:whep:ext:core:server-sent-events',
    Layer: 'urn:ietf:params:whep:ext:core:layer'
  }
}

async function waitForIceGatheringComplete(pc, signal) {
  if (signal?.aborted)
    throw new DOMException('The operation was aborted', 'AbortError')
  if (pc.iceGatheringState === 'complete') return

  await new Promise((resolve, reject) => {
    let settled = false
    const cleanup = () => {
      pc.removeEventListener('icegatheringstatechange', onStateChange)
      signal?.removeEventListener('abort', onAbort)
    }
    const onStateChange = () => {
      if (settled || pc.iceGatheringState !== 'complete') return
      settled = true
      cleanup()
      resolve()
    }
    const onAbort = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new DOMException('The operation was aborted', 'AbortError'))
    }

    pc.addEventListener('icegatheringstatechange', onStateChange)
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) {
      onAbort()
      return
    }
    onStateChange()
  })
}

export class WHEPClient extends EventTarget {
  constructor() {
    super()
    //Ice properties
    this.iceUsername = null
    this.icePassword = null
    //Pending candidadtes
    this.candidates = []
    this.endOfcandidates = false
  }

  async view(pc, url, token, signal) {
    //If already publishing
    if (this.pc) throw new Error('Already viewing')

    //Store pc object and token
    this.token = token
    this.pc = pc

    //Create SDP offer
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await waitForIceGatheringComplete(pc, signal)
    const localOffer = pc.localDescription
    if (!localOffer?.sdp) throw new Error('Local SDP offer unavailable')

    //Request headers
    const headers = {
      'Content-Type': 'application/sdp'
    }

    //If token is set
    if (token) headers['Authorization'] = 'Bearer ' + token

    //Do the post request to the WHEP endpoint with the SDP offer
    const fetched = await fetch(url, {
      method: 'POST',
      body: localOffer.sdp,
      headers,
      signal
    })

    if (!fetched.ok)
      throw new Error('Request rejected with status ' + fetched.status)
    if (!fetched.headers.get('location')) {
      console.log(fetched.headers)
      throw new Error('Response missing location header')
    }

    //Get the resource url
    this.resourceURL = new URL(fetched.headers.get('location'), url)
    // this.resourceURL = new URL(url);

    //Get the links
    const links = {}

    //If the response contained any
    if (fetched.headers.has('link')) {
      //Get all links headers
      const linkHeaders = fetched.headers.get('link').split(/,\s+(?=<)/)

      //For each one
      for (const header of linkHeaders) {
        try {
          let rel,
            params = {}
          //Split in parts
          const items = header.split(';')
          //Create url server
          const url = items[0]
            .trim()
            .replace(/<(.*)>/, '$1')
            .trim()
          //For each other item
          for (let i = 1; i < items.length; ++i) {
            //Split into key/val
            const subitems = items[i].split(/=(.*)/)
            //Get key
            const key = subitems[0].trim()
            //Unquote value
            const value = subitems[1]
              ? subitems[1].trim().replaceAll('"', '').replaceAll("'", '')
              : subitems[1]
            //Check if it is the rel attribute
            if (key === 'rel')
              //Get rel value
              rel = value
            //Unquote value and set them
            else params[key] = value
          }
          //Ensure it is an ice server
          if (!rel) continue
          if (!links[rel]) links[rel] = []
          //Add to config
          links[rel].push({ url, params })
        } catch (e) {
          console.error(e)
        }
      }
    }

    //Get extensions url
    if (links.hasOwnProperty(Extensions.Core.ServerSentEvents))
      //Get url
      this.eventsUrl = new URL(
        links[Extensions.Core.ServerSentEvents][0].url,
        url
      )
    if (links.hasOwnProperty(Extensions.Core.Layer))
      this.layerUrl = new URL(links[Extensions.Core.Layer][0].url, url)

    //If we have an event url
    if (this.eventsUrl) {
      //Get supported events
      const events = links[Extensions.Core.ServerSentEvents][0].params.events
        ? links[Extensions.Core.ServerSentEvents][0].params.events.split(',')
        : ['active', 'inactive', 'layers', 'viewercount']
      //Request headers
      const headers = {
        'Content-Type': 'application/json'
      }

      //If token is set
      if (this.token) headers['Authorization'] = 'Bearer ' + this.token

      //Do the post request to the whep resource
      fetch(this.eventsUrl, {
        method: 'POST',
        body: JSON.stringify(events),
        headers,
        signal
      }).then((fetched) => {
        //If the event channel could be created
        if (!fetched.ok) return
        //If we were stopped while the request was in flight
        if (!this.pc) return
        //Get the resource url
        const sseUrl = new URL(fetched.headers.get('location'), this.eventsUrl)
        //Open it
        this.eventSource = new EventSource(sseUrl)
        //this.eventSource.onopen = (event) => console.log(event);
        //this.eventSource.onerror = (event) => console.log(event);
        //Listen for events
        this.eventSource.onmessage = (event) => {
          //console.dir(event);
          this.dispatchEvent(event)
        }
      }).catch((error) => {
        if (error?.name === 'AbortError') return
        console.warn('WHEP SSE registration failed', error)
      })
    }

    //Get current config
    const config = pc.getConfiguration()

    //If it has ice server info and it is not overriden by the client
    if (
      (!config.iceServer || !config.iceServer.length) &&
      links.hasOwnProperty('ice-server')
    ) {
      //ICe server config
      config.iceServers = []

      //For each one
      for (const server of links['ice-server']) {
        try {
          //Create ice server
          const iceServer = {
            urls: server.url
          }
          //For each other param
          for (const [key, value] of Object.entries(server.params)) {
            //Get key in cammel case
            const cammelCase = key.replace(/([-_][a-z])/gi, ($1) =>
              $1.toUpperCase().replace('-', '').replace('_', '')
            )
            //Unquote value and set them
            iceServer[cammelCase] = value
          }
          //Add to config
          config.iceServers.push(iceServer)
        } catch (e) {
          //Ignore errors
        }
      }

      //If any configured
      if (config.iceServers.length)
        //Set it
        pc.setConfiguration(config)
    }

    //Get the SDP answer
    const answer = await fetched.text()

    // TODO: chrome is returning a wrong value, so don't use it for now
    //try {
    //	//Get local ice properties
    //	const local = this.pc.getTransceivers()[0].sender.transport.iceTransport.getLocalParameters();
    //	//Get them for transport
    //	this.iceUsername = local.usernameFragment;
    //	this.icePassword = local.password;
    //} catch (e) {
    //Fallback for browsers not supporting ice transport
    this.iceUsername = localOffer.sdp.match(/a=ice-ufrag:(.*)\r\n/)[1]
    this.icePassword = localOffer.sdp.match(/a=ice-pwd:(.*)\r\n/)[1]
    //}

    //And set remote description
    await pc.setRemoteDescription({ type: 'answer', sdp: answer })
  }

  async restart() {
    //Clear any pendint timeout
    this.iceTrickeTimeout = clearTimeout(this.iceTrickeTimeout)

    //Clean candidates and end of candidates flag as new ones will be retrieved
    this.candidates = []
    this.endOfcandidates = false

    //Restart ice
    this.pc.restartIce()
    //Create a new offer
    const offer = await this.pc.createOffer({ iceRestart: true })
    //Update ice
    this.iceUsername = offer.sdp.match(/a=ice-ufrag:(.*)\r\n/)[1]
    this.icePassword = offer.sdp.match(/a=ice-pwd:(.*)\r\n/)[1]
    //Set it
    await this.pc.setLocalDescription(offer)

    //Set restart flag time
    this.restartIce = new Date()

    //Clear any pendint timeout
    this.iceTrickeTimeout = clearTimeout(this.iceTrickeTimeout)

    //patch
    return this.patch()
  }

  async patch() {
    //Clear any pendint timeout
    this.iceTrickeTimeout = clearTimeout(this.iceTrickeTimeout)

    //Check if there is any pending data
    if (
      !(this.candidates.length || this.endOfcandidates || this.restartIce) ||
      !this.resourceURL
    )
      //Do nothing
      return

    //Get data
    const candidates = this.candidates
    const endOfcandidates = this.endOfcandidates
    const restartIce = this.restartIce

    //Clean pending data before async operation
    this.candidates = []
    this.endOfcandidates = false

    //Prepare fragment
    let fragment =
      'a=ice-ufrag:' +
      this.iceUsername +
      '\r\n' +
      'a=ice-pwd:' +
      this.icePassword +
      '\r\n'
    //Get peerconnection transceivers
    const transceivers = this.pc.getTransceivers()
    //Get medias
    const medias = {}
    //If doing something else than a restart
    if (candidates.length || endOfcandidates)
      //Create media object for first media always
      medias[transceivers[0].mid] = {
        mid: transceivers[0].mid,
        kind: transceivers[0].receiver.track.kind,
        candidates: []
      }
    //For each candidate
    for (const candidate of candidates) {
      //Get mid for candidate
      const mid = candidate.sdpMid
      //Get associated transceiver
      const transceiver = transceivers.find((t) => t.mid === mid)
      //Get media
      let media = medias[mid]
      //If not found yet
      if (!media)
        //Create media object
        media = medias[mid] = {
          mid,
          kind: transceiver.receiver.track.kind,
          candidates: []
        }
      //Add candidate
      media.candidates.push(candidate)
    }
    //For each media
    for (const media of Object.values(medias)) {
      //Add media to fragment
      fragment +=
        'm=' +
        media.kind +
        ' 9 UDP/TLS/RTP/SAVPF 0\r\n' +
        'a=mid:' +
        media.mid +
        '\r\n'
      //Add candidate
      for (const candidate of media.candidates)
        fragment += 'a=' + candidate.candidate + '\r\n'
      if (endOfcandidates) fragment += 'a=end-of-candidates\r\n'
    }

    //Request headers
    const headers = {
      'Content-Type': 'application/trickle-ice-sdpfrag'
    }

    //If doing an ice restart
    if (restartIce)
      //Set if match to any
      headers['If-Match'] = '*'
    else if (this.etag)
      //Set if match to last known etag
      headers['If-Match'] = this.etag

    //If token is set
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token

    //Do the post request to the WHIP resource
    const fetched = await fetch(this.resourceURL, {
      method: 'PATCH',
      body: fragment,
      headers
    })
    if (!fetched.ok && fetched.status !== 501 && fetched.status !== 405)
      throw new Error('Request rejected with status ' + fetched.status)

    //If we have got an answer for the ice restart
    if (restartIce && fetched.status === 200) {
      //Get etag
      this.etag = fetched.headers.get('etag')

      //Get the SDP answer
      const answer = await fetched.text()
      //Get remote icename and password
      const iceUsername = answer.match(/a=ice-ufrag:(.*)\r\n/)[1]
      const icePassword = answer.match(/a=ice-pwd:(.*)\r\n/)[1]
      const candidates = Array.from(
        answer.matchAll(/(a=candidate:.*\r\n)/gm)
      ).map((res) => res[1])

      //Get current remote rescription
      const remoteDescription = this.pc.remoteDescription

      //Change username and password
      remoteDescription.sdp = remoteDescription.sdp.replaceAll(
        /(a=ice-ufrag:)(.*)\r\n/gm,
        '$1' + iceUsername + '\r\n'
      )
      remoteDescription.sdp = remoteDescription.sdp.replaceAll(
        /(a=ice-pwd:)(.*)\r\n/gm,
        '$1' + icePassword + '\r\n'
      )

      //Remove all candidates
      remoteDescription.sdp = remoteDescription.sdp.replaceAll(
        /(a=candidate:.*\r\n)/gm,
        ''
      )

      //Add candidates
      remoteDescription.sdp = remoteDescription.sdp.replaceAll(
        /(m=.*\r\n)/gm,
        '$1' + candidates.join()
      )

      //Set it
      await this.pc.setRemoteDescription(remoteDescription)

      //If we are still the last ice restart
      if (this.restartIce === restartIce) {
        //Clean the flag
        this.restartIce = null
        //Check if there is any pending data
        if (this.candidates.length || this.endOfcandidates)
          //Tricke again
          this.patch()
      }
    }
  }

  async mute(muted) {
    //Request headers
    const headers = {
      'Content-Type': 'application/json'
    }

    //If token is set
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token

    //Do the post request to the whep resource
    const fetched = await fetch(this.resourceURL, {
      method: 'POST',
      body: JSON.stringify(muted),
      headers
    })
  }

  async selectLayer(layer) {
    if (!this.layerUrl)
      throw new Error('whep resource does not support layer selection')

    //Request headers
    const headers = {
      'Content-Type': 'application/json'
    }

    //If token is set
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token

    //Do the post request to the whep resource
    const fetched = await fetch(this.layerUrl, {
      method: 'POST',
      body: JSON.stringify(layer),
      headers
    })
  }

  async unselectLayer() {
    if (!this.layerUrl)
      throw new Error('whep resource does not support layer selection')

    //Request headers
    const headers = {}

    //If token is set
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token

    //Do the post request to the whep resource
    const fetched = await fetch(this.layerUrl, {
      method: 'DELETE',
      headers
    })
  }

  async stop() {
    if (!this.pc) {
      // Already stopped
      return
    }

    //Cancel any pending timeout
    this.iceTrickeTimeout = clearTimeout(this.iceTrickeTimeout)

    //Close the server sent event channel
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    //Close peerconnection
    this.pc.close()

    //Null
    this.pc = null

    //If we don't have the resource url
    if (!this.resourceURL)
      throw new Error('WHEP resource url not available yet')

    //Request headers
    const headers = {}

    //If token is set
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token

    //Send a delete
    await fetch(this.resourceURL, {
      method: 'DELETE',
      headers
    })
  }
}
