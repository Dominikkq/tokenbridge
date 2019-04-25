const FederatedManager = artifacts.require('./FederatedManager');
const MainToken = artifacts.require('./MainToken');
const SideToken = artifacts.require('./SideToken');
const Bridge = artifacts.require('./Bridge');

const expectThrow = require('./utils').expectThrow;

contract('FederatedManager', function (accounts) {
    const members = [ accounts[1], accounts[2], accounts[3], accounts[4], accounts[5] ];
    const notmember = accounts[0];
    
    describe('members and votes', function () {
        beforeEach(async function () {
            this.manager = await FederatedManager.new(members);
        });

        it('is member', async function() {
            const notmember = await this.manager.isMember(accounts[0]);
            
            assert.equal(notmember, false);
            
            for (var k = 0; k < members.length; k++) {
                const ismember = await this.manager.isMember(members[k]);
                
                assert.ok(ismember);
            }
        });

        it('no votes for unknown transaction', async function() {
            const votes = await this.manager.transactionVotes(1, "0x02", "0x03", accounts[4], 5);

            assert.ok(votes);
            assert.ok(Array.isArray(votes));
            assert.equal(votes.length, 0);
            
            const novotes = await this.manager.transactionNoVotes(1, "0x02", "0x03", accounts[4], 5);
            
            assert.equal(novotes, 0);
        });

        it('one vote for transaction', async function() {
            await this.manager.voteTransaction(1, "0x02", "0x03", accounts[4], 5, { from: members[0] });
            
            const votes = await this.manager.transactionVotes(1, "0x02", "0x03", accounts[4], 5);

            assert.ok(votes);
            assert.ok(Array.isArray(votes));
            assert.equal(votes.length, 1);
            assert.equal(votes[0], members[0]);
            
            const novotes = await this.manager.transactionNoVotes(1, "0x02", "0x03", accounts[4], 5);
            
            assert.equal(novotes, 1);
        });

        it('vote only member', async function() {
            expectThrow(this.manager.voteTransaction(1, "0x02", "0x03", accounts[4], 5));
            
            const votes = await this.manager.transactionVotes(1, "0x02", "0x03", accounts[4], 5);

            assert.ok(votes);
            assert.ok(Array.isArray(votes));
            assert.equal(votes.length, 0);
        });

        it('two votes for transaction', async function() {
            await this.manager.voteTransaction(1, "0x02", "0x03", accounts[4], 5, { from: members[0] });
            await this.manager.voteTransaction(1, "0x02", "0x03", accounts[4], 5, { from: members[1] });
            
            const votes = await this.manager.transactionVotes(1, "0x02", "0x03", accounts[4], 5);

            assert.ok(votes);
            assert.ok(Array.isArray(votes));
            assert.equal(votes.length, 2);
            assert.equal(votes[0], members[0]);
            assert.equal(votes[1], members[1]);
            
            const novotes = await this.manager.transactionNoVotes(1, "0x02", "0x03", accounts[4], 5);
            
            assert.equal(novotes, 2);
        });

        it('two repeated votes for transaction', async function() {
            await this.manager.voteTransaction(1, "0x02", "0x03", accounts[4], 5, { from: members[0] });
            await this.manager.voteTransaction(1, "0x02", "0x03", accounts[4], 5, { from: members[0] });
            
            const votes = await this.manager.transactionVotes(1, "0x02", "0x03", accounts[4], 5);

            assert.ok(votes);
            assert.ok(Array.isArray(votes));
            assert.equal(votes.length, 1);
            assert.equal(votes[0], members[0]);
        });
    });

    describe('transferable', function () {
        beforeEach(async function () {
            this.manager = await FederatedManager.new(members);
        });
        
        it('set transferable', async function () {
            await this.manager.setTransferable(accounts[6]);
            
            const transferable = await this.manager.transferable();
            
            assert.equal(transferable, accounts[6]);
        });
        
        it('set transferable only owner', async function () {
            expectThrow(this.manager.setTransferable(accounts[6], { from: accounts[1] }));
            
            const transferable = await this.manager.transferable();
            
            assert.equal(transferable, 0);
        });
        
        it('set transferable only once', async function () {
            await this.manager.setTransferable(accounts[6]);
            expectThrow(this.manager.setTransferable(accounts[7]));
            
            const transferable = await this.manager.transferable();
            
            assert.equal(transferable, accounts[6]);
        });
    });

    describe('accept transfer using bridge', function () {
        const managerOwner = accounts[0];
        const tokenOwner = accounts[6];
        const bridgeOwner = accounts[7];
        const anAccount = accounts[8];
        
        beforeEach(async function () {
            this.manager = await FederatedManager.new(members, { from: managerOwner });
            this.token = await MainToken.new("MAIN", "MAIN", 18, 10000, { from: tokenOwner });
            this.bridge = await Bridge.new(this.manager.address, this.token.address, { from: bridgeOwner });

            await this.token.transfer(this.bridge.address, 1000, { from: tokenOwner });
            await this.manager.setTransferable(this.bridge.address);
        });
        
        it('initial state', async function () {
            const tokenOwnerBalance = await this.token.balanceOf(tokenOwner);
            assert.equal(tokenOwnerBalance, 9000);

            const bridgeBalance = await this.token.balanceOf(this.bridge.address);
            assert.equal(bridgeBalance, 1000);

            const anAccountBalance = await this.token.balanceOf(anAccount);
            assert.equal(anAccountBalance, 0);
        });
        
        if('no block voted yet', async function () {
            const lastBlockNumber = await this.manager.lastBlockNumber(members[0]);
            
            assert.equal(lastBlockNumber, 0);
            
            const lastBlockHash = await this.manager.lastBlockHash(members[0]);
            
            assert.equals(lastBlockHash, 0);
        });
        
        it('two votes of five no accept transfer', async function () {
            await this.manager.voteTransaction(1, '0x02', '0x03', anAccount, 100, { from: members[0] });
            await this.manager.voteTransaction(1, '0x02', '0x03', anAccount, 100, { from: members[1] });
            
            const tokenOwnerBalance = await this.token.balanceOf(tokenOwner);
            assert.equal(tokenOwnerBalance, 9000);

            const bridgeBalance = await this.token.balanceOf(this.bridge.address);
            assert.equal(bridgeBalance, 1000);

            const anAccountBalance = await this.token.balanceOf(anAccount);
            assert.equal(anAccountBalance, 0);
            
            const lastBlockNumber1 = await this.manager.lastBlockNumber(members[0]);
            const lastBlockHash1 = await this.manager.lastBlockHash(members[0]);
            
            assert.equal(lastBlockNumber1, 1);
            assert.equal(lastBlockHash1, '0x0200000000000000000000000000000000000000000000000000000000000000');

            const lastBlockNumber2 = await this.manager.lastBlockNumber(members[1]);
            const lastBlockHash2 = await this.manager.lastBlockHash(members[1]);

            assert.equal(lastBlockNumber2, 1);
            assert.equal(lastBlockHash2 , '0x0200000000000000000000000000000000000000000000000000000000000000');
        });

        it('votes two transactions', async function () {
            await this.manager.voteTransaction(1, '0x03', '0x03', anAccount, 100, { from: members[0] });
            await this.manager.voteTransaction(2, '0x02', '0x03', anAccount, 100, { from: members[0] });
            
            const tokenOwnerBalance = await this.token.balanceOf(tokenOwner);
            assert.equal(tokenOwnerBalance, 9000);

            const bridgeBalance = await this.token.balanceOf(this.bridge.address);
            assert.equal(bridgeBalance, 1000);

            const anAccountBalance = await this.token.balanceOf(anAccount);
            assert.equal(anAccountBalance, 0);
            
            const lastBlockNumber = await this.manager.lastBlockNumber(members[0]);
            const lastBlockHash = await this.manager.lastBlockHash(members[0]);
            
            assert.equal(lastBlockNumber, 2);
            assert.equal(lastBlockHash, '0x0200000000000000000000000000000000000000000000000000000000000000');
        });

        it('votes two transactions in inverser block order', async function () {
            await this.manager.voteTransaction(2, '0x03', '0x03', anAccount, 100, { from: members[0] });
            await this.manager.voteTransaction(1, '0x02', '0x03', anAccount, 100, { from: members[0] });
            
            const tokenOwnerBalance = await this.token.balanceOf(tokenOwner);
            assert.equal(tokenOwnerBalance, 9000);

            const bridgeBalance = await this.token.balanceOf(this.bridge.address);
            assert.equal(bridgeBalance, 1000);

            const anAccountBalance = await this.token.balanceOf(anAccount);
            assert.equal(anAccountBalance, 0);
            
            const lastBlockNumber = await this.manager.lastBlockNumber(members[0]);
            const lastBlockHash = await this.manager.lastBlockHash(members[0]);
            
            assert.equal(lastBlockNumber, 2);
            assert.equal(lastBlockHash, '0x0300000000000000000000000000000000000000000000000000000000000000');
        });
        
        it('three votes of five then accept transfer', async function () {
            await this.manager.voteTransaction(1, "0x02", "0x03", anAccount, 100, { from: members[0] });
            await this.manager.voteTransaction(1, "0x02", "0x03", anAccount, 100, { from: members[1] });
            await this.manager.voteTransaction(1, "0x02", "0x03", anAccount, 100, { from: members[2] });
            
            const tokenOwnerBalance = await this.token.balanceOf(tokenOwner);
            assert.equal(tokenOwnerBalance, 9000);

            const bridgeBalance = await this.token.balanceOf(this.bridge.address);
            assert.equal(bridgeBalance, 900);

            const anAccountBalance = await this.token.balanceOf(anAccount);
            assert.equal(anAccountBalance, 100);

            const votes = await this.manager.transactionVotes(1, "0x02", "0x03", anAccount, 100);

            assert.ok(votes);
            assert.ok(Array.isArray(votes));
            assert.equal(votes.length, 0);
        });
        
        it('four votes of five only one accept transfer', async function () {
            await this.manager.voteTransaction(1, "0x02", "0x03", anAccount, 100, { from: members[0] });
            await this.manager.voteTransaction(1, "0x02", "0x03", anAccount, 100, { from: members[1] });
            await this.manager.voteTransaction(1, "0x02", "0x03", anAccount, 100, { from: members[2] });
            await this.manager.voteTransaction(1, "0x02", "0x03", anAccount, 100, { from: members[3] });
            
            const tokenOwnerBalance = await this.token.balanceOf(tokenOwner);
            assert.equal(tokenOwnerBalance, 9000);

            const bridgeBalance = await this.token.balanceOf(this.bridge.address);
            assert.equal(bridgeBalance, 900);

            const anAccountBalance = await this.token.balanceOf(anAccount);
            assert.equal(anAccountBalance, 100);

            const votes = await this.manager.transactionVotes(1, "0x02", "0x03", anAccount, 100);

            assert.ok(votes);
            assert.ok(Array.isArray(votes));
            assert.equal(votes.length, 0);
        });
    });

    describe('accept transfer using side token', function () {
        const managerOwner = accounts[0];
        const tokenOwner = accounts[6];
        const anAccount = accounts[7];
        
        beforeEach(async function () {
            this.manager = await FederatedManager.new(members, { from: managerOwner });
            this.token = await SideToken.new("MAIN", "MAIN", 18, this.manager.address, { from: tokenOwner });

            await this.manager.setTransferable(this.token.address);
        });
        
        it('initial state', async function () {
            const tokenOwnerBalance = await this.token.balanceOf(tokenOwner);
            assert.equal(tokenOwnerBalance, 0);

            const managerBalance = await this.token.balanceOf(this.manager.address);
            assert.equal(managerBalance, 0);

            const anAccountBalance = await this.token.balanceOf(anAccount);
            assert.equal(anAccountBalance, 0);
        });
        
        it('two votes of five no accept transfer', async function () {
            await this.manager.voteTransaction(1, "0x02", "0x03", anAccount, 100, { from: members[0] });
            await this.manager.voteTransaction(1, "0x02", "0x03", anAccount, 100, { from: members[1] });

            const processed = await this.manager.transactionWasProcessed(1, "0x02", "0x03", anAccount, 100);
            assert.equal(processed, false);
            
            const tokenOwnerBalance = await this.token.balanceOf(tokenOwner);
            assert.equal(tokenOwnerBalance, 0);

            const managerBalance = await this.token.balanceOf(this.manager.address);
            assert.equal(managerBalance, 0);

            const anAccountBalance = await this.token.balanceOf(anAccount);
            assert.equal(anAccountBalance, 0);
        });
        
        it('three votes of five then accept transfer', async function () {
            await this.manager.voteTransaction(1, "0x02", "0x03", anAccount, 100, { from: members[0] });
            await this.manager.voteTransaction(1, "0x02", "0x03", anAccount, 100, { from: members[1] });
            await this.manager.voteTransaction(1, "0x02", "0x03", anAccount, 100, { from: members[2] });
            
            const processed = await this.manager.transactionWasProcessed(1, "0x02", "0x03", anAccount, 100);
            assert.equal(processed, true);
            
            const tokenOwnerBalance = await this.token.balanceOf(tokenOwner);
            assert.equal(tokenOwnerBalance, 0);

            const managerBalance = await this.token.balanceOf(this.manager.address);
            assert.equal(managerBalance, 0);

            const anAccountBalance = await this.token.balanceOf(anAccount);
            assert.equal(anAccountBalance, 100);

            const votes = await this.manager.transactionVotes(1, "0x02", "0x03", anAccount, 100);

            assert.ok(votes);
            assert.ok(Array.isArray(votes));
            assert.equal(votes.length, 0);
        });
        
        it('four votes of five only one accept transfer', async function () {
            await this.manager.voteTransaction(1, "0x02", "0x03", anAccount, 100, { from: members[0] });
            await this.manager.voteTransaction(1, "0x02", "0x03", anAccount, 100, { from: members[1] });
            await this.manager.voteTransaction(1, "0x02", "0x03", anAccount, 100, { from: members[2] });
            await this.manager.voteTransaction(1, "0x02", "0x03", anAccount, 100, { from: members[3] });
            
            const processed = await this.manager.transactionWasProcessed(1, "0x02", "0x03", anAccount, 100);
            assert.equal(processed, true);

            const tokenOwnerBalance = await this.token.balanceOf(tokenOwner);
            assert.equal(tokenOwnerBalance, 0);

            const managerBalance = await this.token.balanceOf(this.manager.address);
            assert.equal(managerBalance, 0);

            const anAccountBalance = await this.token.balanceOf(anAccount);
            assert.equal(anAccountBalance, 100);

            const votes = await this.manager.transactionVotes(1, "0x02", "0x03", anAccount, 100);

            assert.ok(votes);
            assert.ok(Array.isArray(votes));
            assert.equal(votes.length, 0);
        });
    });
});

