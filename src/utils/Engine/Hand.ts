import { Player } from './Player';
import { Blind } from './Blind';
import { CircularHandStatusMap } from './CircularHandStatusMap';
import { Deck } from './Deck';
import { Card } from './Card';
import { HandStatus } from './HandStatus';
import { Pot } from './Pot';
import { BestHand } from './BestHand';

export class Hand{

    private circularHandStatusMap: CircularHandStatusMap;
    private pots: Array<Pot>;
    private handStage: number; //0 -> Preflop 1 -> flop 2 -> turn 3 -> river 4 -> done
    private deck: Deck;
    private board: Array<Card>;
    private smallBlindPosition: number;
    private bigBlindPosition: number;
    private bigBlindSize: number;

    readonly PREFLOP_STAGE= 0;
    readonly FLOP_STAGE = 1;
    readonly TURN_STAGE= 2;
    readonly RIVER_STAGE = 3;
    readonly DONE_STAGE= 4;
    

    constructor(stackMap: Map<Player, number>, blinds: Blind, bigBlindPosition: number)
    {
        this.deck = new Deck();
        bigBlindPosition = this.cleanStackMap(stackMap, bigBlindPosition);
        if(bigBlindPosition == -1)
        {
            console.log("Unable to correctly set the bigBlindPosition for the hand. Hand initialization failed");
            return;
        }

        let positionNumber = 0;
        let smallBlindPosition = bigBlindPosition + 1;
        let handStatusMap = new Map<Player, HandStatus>();
        let initialActionPointer = 0;
        
        if(smallBlindPosition >= stackMap.size)
        {
            smallBlindPosition = 0;
        }
        for( let [player, stackSize] of stackMap )
        {
            handStatusMap.set(player, new HandStatus(stackSize));
            if(positionNumber == bigBlindPosition)
            {
                handStatusMap.get(player).bet(blinds.getBigBlind());
            }
            else if(positionNumber == smallBlindPosition)
            {
                handStatusMap.get(player).bet(blinds.getSmallBlind());
            }
            positionNumber++;
        }
        if(bigBlindPosition - 1 < 0)
        {
            initialActionPointer = handStatusMap.size - 1;
        }
        else
        {
            initialActionPointer = bigBlindPosition - 1;
        }

        this.smallBlindPosition = smallBlindPosition;
        this.pots = new Array<Pot>();
        this.board = new Array<Card>();
        this.circularHandStatusMap = new CircularHandStatusMap(handStatusMap, initialActionPointer);
        this.dealCards();
        this.handStage = this.PREFLOP_STAGE;
        this.bigBlindPosition = bigBlindPosition;
        this.bigBlindSize = blinds.getBigBlind();
    }

    private dealCards()
    {   
        //After the dealing cards loop the action pointer will be at the same point as it was at initialization.
        for(let i = 0; i < this.circularHandStatusMap.size; i++)
        {
            this.circularHandStatusMap.dealToActivePlayer(this.deck);
            this.circularHandStatusMap.next();
        }
    }

    //Clean out 0 stacks from stackmap and change big blind pointer to account for the changed map.
    //Returns the new big blind position given the cleaned stack map.
    private cleanStackMap(stackMap: Map<Player, number>, bigBlindPosition: number): number
    {
        let position = 0;
        let BbPlayer;
        for( let [player, stackSize] of stackMap )
        {
            if(position == bigBlindPosition)
            {
                BbPlayer = player;
            }
            if(stackSize == 0)
            {
                stackMap.delete(player);
            }
            position++;
        }

        //Loop through cleaned stackmap to position the big blind pointer correctly.
        //This function assumes the supplied stackmap already had the bigBlindPosition correctly placed
        //To a non 0 stack player beforehand.
        position = 0;
        for( let [player, stackSize] of stackMap )
        {
            if(player.equals(BbPlayer))
            {
                return position;
            }
            position++;
        }
        return -1;
    }

    //The stage of the hand is over if
    // (1) All but one person has folded
    // (2) The current highest bet made by a players has been met by each non-folded player
    // (3) All non-folded players have checked.
    private checkNextHandStage()
    {
        if(this.everyoneFolded())
        {
            //Hand stage completed from folding.
            this.calculatePots();
            this.nextHandStage(true);
            return;
        }
        else if((this.everyoneChecked() || this.highestBetMatched()) && this.preFlopBigBlindDidAction())
        {
            this.calculatePots();
            this.nextHandStage(false);
        }
    }

    private everyoneFolded(): boolean
    {
        let counter = 0;
        for( let [player, handStatus] of this.getHandStatusMap() )
        {
            if(handStatus.isFolded())
            {
                counter++;
            }
        }
        if(counter == this.getHandStatusMap().size - 1)
        {
            return true;
        }
        else
        {
            return false;
        }
    }

    private everyoneChecked(): boolean
    {
        let counter = 0;
        for( let [player, handStatus] of this.getHandStatusMap() )
        {
            if(handStatus.isChecked() || handStatus.isFolded())
            {
                counter++;
            }
        }
        if(counter == this.getHandStatusMap().size)
        {
            return true;
        }
        return false;
    }

    private highestBetMatched(): boolean
    {
        let highestBet = this.circularHandStatusMap.getHighestBet();

        let counter = 0;
        for( let [player, handStatus] of this.getHandStatusMap() )
        {
            if((handStatus.getBetChips() < highestBet) && !handStatus.isFolded() && !handStatus.isAllIn() || highestBet == 0)
            {
               return false;
            }
            else
            {
                counter++;
            }
        }
        if(counter == this.getHandStatusMap().size)
        {
            return true;
        }
        return false;
    }

    //Check to see if the hand is complete and a winner should be calculated/declared.
    //If a winner should not be declared move hand to the next stage.
    private nextHandStage(fromFolding: boolean)
    {
        if(fromFolding)
        {
            this.declareWinner(fromFolding);
            this.handStage = this.DONE_STAGE;
            return;
        }

        this.circularHandStatusMap.prepStatusForNextStage();

        this.handStage++;
        if(this.allButOneAllIn())
        {
            while( this.board.length < 5)
            {
                this.board.push(this.deck.drawCard());
            }
            this.handStage = this.DONE_STAGE;
        }
   
        if(this.handStage == this.FLOP_STAGE)
        {
            for(let i = 0; i < 3; i++)
            {
                this.board.push(this.deck.drawCard());
            }
            this.circularHandStatusMap.setActivePlayer(this.smallBlindPosition);
            if(this.circularHandStatusMap.getHandStatusMap().size == 2) //Special case for heads up hand
            {
                this.circularHandStatusMap.next();
            }
        }
        else if(this.handStage == this.TURN_STAGE || this.handStage == this.RIVER_STAGE)
        {
            this.board.push(this.deck.drawCard());
            this.circularHandStatusMap.setActivePlayer(this.smallBlindPosition);
            if(this.circularHandStatusMap.getHandStatusMap().size == 2) //Special case for heads up hand
            {
                this.circularHandStatusMap.next();
            }
        }
        else if(this.handStage == this.DONE_STAGE)
        {
            this.declareWinner(fromFolding);
        }
        
    }

    private declareWinner(fromFolding: boolean)
    {
        if(fromFolding)
        {
            console.log("Winner of hand has been declared from folding");
            for( let [player, handStatus] of this.getHandStatusMap() )
            {
                if(!handStatus.isFolded())
                {
                    for(let pot of this.pots)
                    {
                        handStatus.addToStackSize(pot.getSize());
                    }
                }
            }
        }
        else 
        {
            for(let pot of this.pots)
            {
                //Create temporary hand status map only for players of the pot.
                let tempStatusMap = new Map<Player, HandStatus>();
                for(let player of pot.getPlayers())
                {
                    tempStatusMap.set(player, this.getHandStatusMap().get(player));
                }
                
                if(tempStatusMap.size === 1) //Special case for 1 man pots
                {
                    let handStatus = this.getHandStatusMap().get(Array.from(tempStatusMap.keys())[0]); //Get only player inserted
                    handStatus.addToStackSize(pot.getSize()); //Since its the only player for the pot give them the chips
                }
                else
                {
                    const bestHand = new BestHand(tempStatusMap, this.getBoard());
                    //infoArray should contain array of 3 elements: Player, winning Array<Card> combination, and the category object
                    const infoArray = bestHand.findWinner();
                    console.log("info array: ", infoArray);
                    //check if outright winner
                    if (infoArray.length === 1) {
                        const winningPlayer = infoArray[0][0];
                        console.log(winningPlayer.getName(),`won ${pot.getSize()} with`, infoArray[0][2].categoryName);
                        console.log(`winning hand: `, infoArray[0][1]);
                        let handStatus = this.getHandStatusMap().get(winningPlayer);
                        handStatus.addToStackSize(pot.getSize());
                    }
                    else { //split pot
                        for (let i = 0; i < infoArray.length; i++) {
                            let winningPlayer = infoArray[i][0];
                            let winnings = Math.floor(pot.getSize()/infoArray.length);
                            console.log(winningPlayer.getName(),"split pot with ", infoArray[i][2].categoryName);
                            console.log(`they won ${winnings} with hand: `, infoArray[i][1]);
                            let handStatus = this.getHandStatusMap().get(winningPlayer);
                            handStatus.addToStackSize(winnings);
                        }
                    }
                }
            }
        }
    }

    public getActivePlayer(): Player
    {
        return this.circularHandStatusMap.getActivePlayer();
    }

    public getHandStatusMap(): Map<Player, HandStatus>
    {
        return this.circularHandStatusMap.getHandStatusMap();
    }

    public getCircularHandStatusMap() : CircularHandStatusMap
    {
        return this.circularHandStatusMap;
    }

    public isComplete(): boolean
    {
        if(this.handStage == this.DONE_STAGE)
        {
            return true;
        }
        return false;
    }

    public fold(player: Player)
    {
        if(this.circularHandStatusMap.getActivePlayer().equals(player))
        {
            this.circularHandStatusMap.fold();
            this.circularHandStatusMap.next();
            this.checkNextHandStage();
        }
        else
        {
            console.log("Fold called for a player that is not currently active: " + player.getName());
        }
    }

    public check(player: Player)
    {
        if(this.circularHandStatusMap.getActivePlayer().equals(player))
        {
            this.circularHandStatusMap.check();
            this.circularHandStatusMap.next();
            this.checkNextHandStage();
        }
        else
        {
            console.log("Check called for a player that is not currently active: " + player.getName());
        }
    }

    public bet(player: Player, amount: number)
    {
        if(this.circularHandStatusMap.getActivePlayer().equals(player))
        {
            if(this.circularHandStatusMap.getHighestBet() == 0 && amount != 0)
            {
                this.circularHandStatusMap.bet(amount);
                this.circularHandStatusMap.next();
                this.checkNextHandStage(); 
            }
            else if(this.circularHandStatusMap.getHighestBet() < amount)
            {
                //If the bet is higher than the last it is considered a raise.
                this.circularHandStatusMap.match(amount);
                this.circularHandStatusMap.next();
                this.checkNextHandStage(); 
            }
            else
            {
                console.log("Not a valid bet/raise amount: " + amount);
            }
        }
        else
        {
            console.log("Bet called for a player that is not currently active: " + player.getName());
        }
    }

    public call(player: Player)
    {
        if(this.circularHandStatusMap.getActivePlayer().equals(player))
        {
            this.circularHandStatusMap.call();
            this.circularHandStatusMap.next();
            this.checkNextHandStage();
        }
        else
        {
            console.log("Call called for a player that is not currently active: " + player.getName());
        }
    }
    
    //Called after next hand stage has been determined. It will go through the current players
    //And bets and create the needed side pots.
    private calculatePots()
    {
        let finished = false;
        while(!finished)
        {
            let playerArray = new Array<Player>()
            let lowestBet = Infinity;
            for( let [player, handStatus] of this.getHandStatusMap() )
            {
                if(!this.getHandStatusMap().get(player).isFolded() && this.getHandStatusMap().get(player).getBetChips() != 0) //If a player is currently not folded they should be included in the pot object.
                {
                    playerArray.push(player);
                }
                if(handStatus.getBetChips() < lowestBet && !this.getHandStatusMap().get(player).isFolded() && this.getHandStatusMap().get(player).getBetChips() != 0)
                {
                    lowestBet = handStatus.getBetChips();
                }
            }
            if(lowestBet < this.circularHandStatusMap.getHighestBet()) //If the lowestbet is lower than highest bet and we move to next hand stage it means there was an all-in that needs a side pot.
            {
                let sidePot = new Pot(playerArray);
                for( let p of playerArray )
                {
                    sidePot.add(lowestBet);
                    this.getHandStatusMap().get(p).removeFromBet(lowestBet);
                }
                this.pots.push(sidePot);
            }
            else
            {
                finished = true;
            }
            
        }
        //Now must add the current made pot to the pots array
        let playerArray = new Array<Player>();
        let pot = new Pot(playerArray);
        for( let [player, handStatus] of this.getHandStatusMap() )
        {
            if(!this.getHandStatusMap().get(player).isFolded() && this.getHandStatusMap().get(player).getBetChips() != 0) //If a player is currently not folded they should be included in the pot object.
            {
                playerArray.push(player);
            }
            pot.add(this.getHandStatusMap().get(player).getBetChips());
        }
        if(playerArray.length != 0) // Player array is 0 if it was a check down hand stage. This will cause errors when determining the winner. So we ignore this pot.
        {
            this.pots.push(pot);
        }
    }

    private allButOneAllIn() : Boolean
    {
        let counter = 0;
        for( let [player, handStatus] of this.circularHandStatusMap.getHandStatusMap() )
        {
            if(handStatus.isFolded() || handStatus.isAllIn())
            {
                counter++;
            }
        }
        if(counter >= this.getHandStatusMap().size - 1)
        {
            return true;
        }
        else
        {
            return false;
        }
    }

    public getPotSize() : number
    {
        let total = 0;
        for(let pot of this.pots)
        {
            total += pot.getSize();
        }
        return total
    }

    public getPots() : Array<Pot>
    {
        return this.pots;
    }

    public getBoard() : Array<Card>
    {
        return this.board;
    }

    private preFlopBigBlindDidAction() : boolean
    {
        if(this.handStage != this.PREFLOP_STAGE)
        {
            return true;
        }
        else //We are preflop. Hand can't move onto next stage until the big blind acted at some point.
        {
            let handStatus = Array.from(this.circularHandStatusMap.getHandStatusMap().values())[this.bigBlindPosition];
            if( !handStatus.isChecked() && !handStatus.isFolded() && handStatus.getBetChips() == this.bigBlindSize)
            {
                return false;
            }
            else
            {
                return true;
            }
        }
    }
}
