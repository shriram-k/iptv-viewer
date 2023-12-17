import jsdata from './playlist.json';
const URL = 'https://raw.githubusercontent.com/shriram-k/iptv-viewer/master/playlist.json';

const getDataFromGithub = async () => {
    const data = await fetch(URL);
    if(data.status !== 200) {
        throw Error();
    }
    return data.body;
}

const playlistParser = async () => {
    let rawData = {};
    try {
        const resp = await getDataFromGithub();
        return resp.json()
    }catch(e) {
        rawData = jsdata
    }
    return rawData;
}

export default playlistParser