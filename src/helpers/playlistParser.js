const DEFAULT_PLAYLIST = 'https://iptv-org.github.io/iptv/index.nsfw.m3u';


const getCountryName = (data) => {
    try {
        if(!data) {
            return ''
        }
        const index = data.indexOf('.')
        let countryCode = data.slice(index + 1, index + 3).toUpperCase()
        let regionNames = new Intl.DisplayNames(['en'], {type: 'region'});
        let countryName =  regionNames.of(countryCode).replaceAll('"', '');
        if(countryCode === 'UK') {
            countryCode = 'GB'
        }
        return {name: countryName, code: countryCode};
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
        const namePreProcessed = data.split(',')
        return namePreProcessed[namePreProcessed.length - 1]
    }catch (e) {
        console.debug(e)
        return ''
    }
    
}

const getCategories = (data) => {
    try {
        let preprocessedGroup = data.split(',')[0];
        preprocessedGroup = preprocessedGroup.split("user-agent")[0];
        preprocessedGroup = preprocessedGroup.replaceAll('"', '')
        preprocessedGroup = preprocessedGroup.replaceAll(' ', '')
        preprocessedGroup = preprocessedGroup.split(';')
        return preprocessedGroup
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
    rawPlaylist.forEach((element, idx) => {
        if(!element) {
            return
        }
        const splitData = element.split('\n');
        const url = splitData.filter((eachStr) => {
            let isUrl = false;
            try {
                new URL(eachStr);
                isUrl = true;
            } catch (_) {
                isUrl = false;
            }
            return isUrl
        })[0]
        const channelData = splitData[0]
        const preprocessedChannelData = channelData.replace('tvg-id=', '@').replace(' tvg-logo=', '@').replace(' group-title=', '@').split('@');
        const country = getCountryName(preprocessedChannelData[1])
        const logo = getLogo(preprocessedChannelData[2])
        const name = getName(preprocessedChannelData[3])
        const categories = getCategories(preprocessedChannelData[3])
        // if(idx === 9265) { //name issue 9266 9265
        //     console.log(idx + ': ')
        //     console.log(preprocessedChannelData)
        //     console.log(preprocessedChannelData[3].split(','))
        //     console.log('-------------------------------------------------------')
        //     console.log({splitData, url, channelData, preprocessedChannelData, country, logo, name, categories})
        // }
        
        channels.push({id: idx, url, country, logo, name, group: categories})
    });
    return channels;
}

export default playlistParser