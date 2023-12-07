const countryHelper = (channels) => {
    let countries = [];
    channels.forEach((eachChannel) => {
        const index = countries.findIndex((eachCountry) => eachCountry.name === eachChannel.country.name)
        
        if(index < 0 && eachChannel.country !== "") {
            countries.push(eachChannel.country);
        }
    })
    return countries.sort((a, b) => {
        if ( a.name < b.name ){
            return -1;
        }
        if ( a.name > b.name ){
        return 1;
        }
        return 0;
    });
}

export default countryHelper;