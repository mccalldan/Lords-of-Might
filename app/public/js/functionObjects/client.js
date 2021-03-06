var Client = {};
Client.socket = {};

if(!JSON.parse(localStorage.getItem('user'))){
    alert("You need to sign in!")
    window.location.replace("/");
}else{

    Client.socket = io.connect();

    // HANDLING CHAT
    // ------------------------------------------------------------------

    Client.sendGlobalMessage = function(message){
        Client.socket.emit('global-message',message)
    }

    Client.socket.on('global-message', function(message){
        var globalMessages = $('#global-messages')
        var user = message.name;
        var body = message.body;

        var message = '<p class="message-text">'+ user + ': ' + body + '</p>'

        globalMessages.append(message)

        $('#global-messages')[0].scrollTop = $('#global-messages')[0].scrollHeight;
        
    })

    Client.sendPrivateMessage = function(message){
        Client.socket.emit('private-message',message)
    }

    Client.socket.on('private-message', function(message){
        console.log(message)
        var privateMessages = $('#private-messages')
        var user = message.name;
        var body = message.body;

        var message = '<p class="message-text">'+ user + ': ' + body + '</p>'

        privateMessages.append(message)

        $('#private-messages')[0].scrollTop = $('#global-messages')[0].scrollHeight;
        
    })



    // HANDLING GAME CONNECTION
    // ------------------------------------------------------------------

    Client.userInfoDB = function(user){
        setTimeout(function(){
            Client.socket.emit('user',user);
        },1000)
    };


    Client.socket.on('render-user', function(data){

    var user_id = data.new.id;
        console.log('new-user')
    if(LoM.game.cache.checkImageKey('user-'+user_id) === false){
        console.log(user_id)
            LoM.game.load.spritesheet('user-'+user_id,'img/users/user-'+user_id+'.png',64,64,273)
            LoM.game.load.start(); 
            LoM.game.load.onLoadComplete.add(function(){
                console.log('add freshly created player!')
                LoM.player.add(data.new)
            }, this);
        }else{
            LoM.player.add(data.new)
        }
    })

    Client.move = function(movement){
        this.socket.emit('key-pressed',movement)
    }

    Client.socket.on('start', function(data){
        // parse data from object
        var userInfo = data.user;
        var otherPlayers = data.others;
        // console.log(data)
        // push data into game object
        LoM.Town.userInfo = userInfo;
        LoM.playerArray = otherPlayers;
        // console.log(userInfo)
        // start game with current game state
        $('.progress').fadeOut('slow',function(){
            $('.progress').remove();
            LoM.game.state.start(userInfo.world.state)
        })
    })


    // HANDLING CHAR MANAGEMENT
    // ------------------------------------------------------------------

    Client.socket.on('move', function(data){
        LoM.player.move(data)
    })

    Client.socket.on('remove',function(data){
        LoM.player.remove(data)
    })

    Client.changeState = function(user){
        // console.log(user)
        LoM.eventActive.state = true;
        this.socket.emit('change-state',user)
    }

    Client.socket.on('change-state',function(user){
            var userID = user.id;
            var state = user.world.state;
            // console.log(LoM.userInfo.world.state,state)
            // LoM.userInfo.world.state = state ;
            initialized = false;
            LoM.playerMaster[userID] = user;
            // return
            if(state !== 'Battle'){
                LoM.user.getInventory(function(){
                    LoM.game.state.start(state)
                });
            }else{

                LoM.game.state.start(state);
            }
    })

    Client.socket.on('player-changed-state',function(player){

        var user = LoM.playerMaster[LoM.userInfo.id];
        // console.log(user.world.state)
        LoM.playerMaster[player.id] = player;
        // if user state is not equal to play state, remove player sprite
        if(user.world.state !== 'Battle'){
            // if incoming player state is not Battle
            if(user.world.state !== player.world.state){
                LoM[user.world.state].spriteMap.players[player.id].kill()
                // console.log('kill sprite')
                // update player changes on playerMaster
                // console.log(LoM.playerMaster[player.id])
            }else if(user.world.state === player.world.state){
            //else if user state is equal to player state, add player sprite
                LoM.player.add(player)
                // console.log('player added')
            }
        }
        
    })


    // HANDLING BATTLE REQUEST
    // ------------------------------------------------------------------

    // initiator sent battle request to server with battle infomation
    Client.battleRequest = function(battleInfo){
        $('#battle-request').fadeOut(function(){
            // console.log('battle request sent')
            Client.socket.emit('battle-request', battleInfo)
        })
    }

    Client.socket.on('battle-requested',function(battleInfo){
        LoM.battleInfo = battleInfo;
        // console.log(battleInfo)
        genBattleInteraction()
        // console.log('battle request received')
        $('#battle-request').remove();
        $('#battle-accept').fadeIn();
        $('#battle-decline').fadeIn();
        var body = LoM.battleInfo.initiator.name + ' requested a battle'
        announcement(body)
    })

    Client.battleAccept = function(battleInfo){
        LoM.battleInfo = battleInfo;
        LoM.battleInfo.receiver = LoM.userInfo;
        // console.log(LoM.userInfo)
        // console.log(LoM.battleInfo)

        // send accept information to server
        this.socket.emit('battle-accept',battleInfo)
        removeInteraction('.interaction')
    }

    Client.socket.on('battle-accepted',function(battleInfo){
        // console.log(battleInfo)
        LoM.battleInfo = battleInfo
        var body = LoM.battleInfo.receiver.name + ' has accept your invitation! Good luck on the battlefield!'
        announcement(body)
        // battleInfo.receiver.id)
        // go to phraser and go to battle phrase with challenger
        // $('#battle')
    })

    Client.battleDecline = function(){
        this.socket.emit('battle-decline',{})
        removeInteraction('.interaction')
    }

    Client.socket.on('battle-declined',function(data){
        var body = LoM.battleInfo.receiver.name + ' has declined your invitation'
        announcement(body)
    })

    Client.socket.on('battle-room',function(instance){
        LoM.battleInfo.room = instance.room;
        var body = 'Joining room: ' + instance.room
        announcement(body)
        setTimeout(function(){
            removeInteraction('.interaction')
            LoM.playerMaster[LoM.userInfo.id].world.state = "Battle"
            var user = LoM.playerMaster[LoM.userInfo.id]
            // console.log('exiting Shop')
            Client.changeState(user);
        },5000)
        // $('#battle')
    })


    // HANDLING BATTLE MECHANICS
    // ------------------------------------------------------------------

    Client.battleAction = function(state){
        console.log('action to client')
        this.socket.emit('battleAction',state)
    }

    Client.socket.on('battleReaction',function(state){
        // update current battle state
        LoM.Battle.state.player = state.player;
        switch(state.action){
            case 'attack':
                LoM.Battle.attack(state)
                return
            case 'spell':
                LoM.Battle.spell(state)
                return
            case 'potion':
                LoM.Battle.potion(state)
                return
        }
    })

    Client.actionCompleted = function(state){
        if(user.id === state.roleID.attacker){
            // console.log('action completed')
            this.socket.emit('actionCompleted', state)
        }
    }

    Client.socket.on('your-turn',function(state){
        // console.log(user.id,'your turn')
        LoM.Battle.state.turn = user.id;
    })
}

