import React, {useMemo} from "react";
import { useSearchParams } from "react-router-dom";
import Wrapper from "../components/Wrapper";
import VideoJS from "../components/VideoJS";

const Player = ({channels}) => {
    let [searchParams] = useSearchParams();
    const playerRef = React.useRef(null);
    
    const handlePlayerReady = (player) => {
        playerRef.current = player;
    
        // You can handle player events here, for example:
        player.on('waiting', () => {
            console.log('player is waiting');
        });
    
        player.on('dispose', () => {
            console.log('player will dispose');
        });
    };

    let channel = useMemo(() => {
        const channelId = searchParams.get('channelId');
        return channels.filter((eachChannel) => '' + eachChannel.id === channelId)[0]
    }, [channels, searchParams])

    return (
        <Wrapper>
            <div>hello{JSON.stringify(channel)}</div>
            <div style={{width: '80vw'}} >
            <VideoJS options={{
                autoplay: false,
                controls: true,
                responsive: true,
                fluid: true,
                sources: [{
                  src: channel.url,
                  type: 'application/x-mpegURL'
                }]
            }} onReady={handlePlayerReady} />
            </div>
        </Wrapper>
    )
}

export default Player;