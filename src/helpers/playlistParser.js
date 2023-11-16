const DEFAULT_PLAYLIST = 'https://iptv-org.github.io/iptv/index.nsfw.m3u';


const getCountryName = (data) => {
    try {
        if(!data) {
            return ''
        }
        const index = data.indexOf('.')
        const countryCode = data.slice(index + 1, index + 3)
        let regionNames = new Intl.DisplayNames(['en'], {type: 'region'});
        return regionNames.of(countryCode.toUpperCase());
    }catch (e) {
        console.debug(e)
        return ''
    }
    
}

const getLogo = (data) => {
    try {
        return data.replaceAll('"', '');
    }catch (e) {
        console.debug(e)
        return ''
    }
}

const getName = (data) => {
    try {
        return data.split(',')[1]
    }catch (e) {
        console.debug(e)
        return ''
    }
    
}

const getGroup = (data) => {
    try {
        const preprocessedGroup = data.split(',')[0];
        return preprocessedGroup.replaceAll('"', '')
    }catch (e) {
        console.debug(e)
        return ''
    }
}


const playlistParser = async (url=DEFAULT_PLAYLIST) => {
    const rawData = await fetch(DEFAULT_PLAYLIST);
    let rawPlaylist = await rawData.text();
    rawPlaylist = rawPlaylist.replace('#EXTM3U\n', '')
    rawPlaylist = rawPlaylist.split('#EXTINF:-1 ')
    const channels = []
    rawPlaylist.forEach(element => {
        if(!element) {
            return
        }
        const splitData = element.split('\n');
        const url = splitData[1]
        const channelData = splitData[0]
        const preprocessedChannelData = channelData.replace('tvg-id=', '@').replace(' tvg-logo=', '@').replace(' group-title=', '@').split('@');
        const country = getCountryName(preprocessedChannelData[1].replaceAll('"', ''))
        const logo = getLogo(preprocessedChannelData[2])
        const name = getName(preprocessedChannelData[3])
        const group = getGroup(preprocessedChannelData[3])
        channels.push({url, country, logo, name, group})
    });
    return channels;
}

export default playlistParser