const {writeFile} = require('fs');
const {getName} = require('country-list');

const getCountryCode = (channel) => {
    const code = channel.country;
    if(!code) {
        throw new Error(`Country code is not available for channel ${channel.name}`)
    }

    if(code === 'UK') {
        return 'GB'
    }

    return code
}

const playlistParser = async () => {
    let rawStreams =  await (await fetch('https://iptv-org.github.io/api/streams.json')).json()
    let rawChannels = await (await fetch('https://iptv-org.github.io/api/channels.json')).json()
    const channels = []
    const countryCodes = []
    const categories = []
    rawStreams.forEach((eachStream, idx) => {
        if(!eachStream.channel || !eachStream.url) {
            // This means there are some streams whose channel details are not available
            return
        }
        const channel = rawChannels.find(eachChannel => eachChannel.id === eachStream.channel)
        if(!channel) {
            // This means there are some streams whose channel details are not available in Channels API
            return
        }

        if(!channel.country) {
            console.log(channel)
        }

        const toAdd =  {
            id: idx,
            url: eachStream.url,
            country: {
              code: getCountryCode(channel),
            },
            logo: channel.logo || '',
            name: channel.name || '',
            group: channel.categories.length > 0 ? channel.categories : ['general']
        }

        if(!countryCodes.includes(toAdd.country.code)) {
            countryCodes.push(toAdd.country.code)
        }

        toAdd.group.forEach((eachGroup) => {
            if(!categories.includes(eachGroup) && eachGroup !== "") {
                categories.push(eachGroup)
            }
        })
        channels.push(toAdd)
    })

    const countriesWithName = []
    countryCodes.forEach((eachCountryCode) => {
        if(eachCountryCode === 'XK') {
            countriesWithName.push({code: eachCountryCode, name: 'Kosovo'})
            return
        }

        const countryName = getName(eachCountryCode)
        if(!countryName) {
            throw new Error(`Country code ${eachCountryCode} does not exist in country-list`)
        }
        countriesWithName.push({code: eachCountryCode, name: countryName})
    })

    const countries = countriesWithName.sort((a, b) => {
        if ( a.name < b.name ){
            return -1;
        }
        if ( a.name > b.name ){
        return 1;
        }
        return 0;
    });
    writeFile('./playlist.json', JSON.stringify({channels, countries, categories}, null, 2), (error) => {
        if (error) {
          console.log('An error has occurred ', error);
          return;
        }
        console.log('Data written successfully to disk');
      });
}

playlistParser()