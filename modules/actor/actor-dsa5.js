import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js"
import DiceDSA5 from "../system/dice-dsa5.js"

export default class Actordsa5 extends Actor {
    static async create(data, options) {
        if (data instanceof Array)
            return super.create(data, options);

        if (data.items)
            return super.create(data, options);

        data.items = [];

        data.flags = {

        }

        let skills = await DSA5_Utility.allSkills() || [];
        let combatskills = await DSA5_Utility.allCombatSkills() || [];
        let moneyItems = await DSA5_Utility.allMoneyItems() || [];

        moneyItems = moneyItems.sort((a, b) => (a.data.price.value > b.data.price.value) ? -1 : 1);
        if (data.type == "character") {
            data.items = data.items.concat(skills);
            data.items = data.items.concat(combatskills);
            data.items = data.items.concat(moneyItems.map(m => {
                m.data.quantity.value = 0
                return m
            }));

            super.create(data, options);
        }
    }

    prepareBaseData() {
        for (let ch of Object.values(this.data.data.characteristics)) {
            ch.value = ch.initial + ch.advances + (ch.modifier || 0);
            ch.bonus = Math.floor(ch.value / 10)
            ch.cost = DSA5_Utility._calculateAdvCost(ch.advances, "characteristic")
        }
    }

    prepareData() {
        try {
            super.prepareData();
            const data = this.data;

            if (this.data.type == "character") {
                this.prepareCharacter();
                data.data.details.experience.current = data.data.details.experience.total - data.data.details.experience.spent;
                data.data.details.experience.description = DSA5_Utility.experienceDescription(data.data.details.experience.total)

                data.data.status.wounds.value = data.data.status.wounds.initial + data.data.characteristics["ko"].value * 2;
                data.data.status.wounds.max = data.data.status.wounds.value + data.data.status.wounds.modifier + data.data.status.wounds.advances;

                data.data.status.astralenergy.value = (data.data.status.astralenergy.initial > 0 ? data.data.status.astralenergy.initial + 20 : 0);
                data.data.status.astralenergy.max = data.data.status.astralenergy.value + data.data.status.astralenergy.modifier + data.data.status.astralenergy.advances;

                data.data.status.karmaenergy.value = (data.data.status.karmaenergy.initial > 0 ? data.data.status.karmaenergy.initial + 20 : 0);
                data.data.status.karmaenergy.max = data.data.status.karmaenergy.value + data.data.status.karmaenergy.modifier + data.data.status.karmaenergy.advances;

                data.data.status.soulpower.value = (data.data.status.soulpower.initial ? data.data.status.soulpower.initial : 0) + Math.round((data.data.characteristics["mu"].value + data.data.characteristics["kl"].value + data.data.characteristics["in"].value) / 6);
                data.data.status.soulpower.max = data.data.status.soulpower.value + data.data.status.soulpower.modifier;

                data.data.status.toughness.value = (data.data.status.soulpower.initial ? data.data.status.soulpower.initial : 0) + Math.round((data.data.characteristics["ko"].value + data.data.characteristics["ko"].value + data.data.characteristics["kk"].value) / 6);
                data.data.status.toughness.max = data.data.status.toughness.value + data.data.status.toughness.modifier;

                this._calculateStatus(data, "dodge")

                data.data.status.fatePoints.max = data.data.status.fatePoints.value + data.data.status.fatePoints.modifier;
                data.data.status.initiative.value = Math.round((data.data.characteristics["mu"].value + data.data.characteristics["ge"].value) / 2);


            }




        } catch (error) {
            console.error("Something went wrong with preparing actor data: " + error)
            ui.notifications.error(game.i18n.localize("ACTOR.PreparationError") + error)
        }
    }

    _calculateStatus(data, attr) {
        switch (attr) {
            case "dodge":
                data.data.status.dodge.value = Math.round(data.data.characteristics["ge"].value / 2);
                data.data.status.dodge.max = data.data.status.dodge.value + data.data.status.dodge.modifier;
                return data.data.status.dodge.max
                break;
        }
    }


    prepareCharacter() {
        if (this.data.type != "character")
            return;

        //calculate some attributes
    }


    prepare() {
        let preparedData = duplicate(this.data)
            // Call prepareItems first to organize and process OwnedItems
        mergeObject(preparedData, this.prepareItems())

        // Add speciality functions for each Actor type
        if (preparedData.type == "character") {
            this.prepareCharacter(preparedData)
        }

        //if (preparedData.type == "npc")
        //this.prepareNPC(preparedData)

        //if (preparedData.type == "creature")
        //this.prepareCreature(preparedData)

        return preparedData;
    }



    static _calculateCombatSkillValues(i, actorData) {
        if (i.data.weapontype.value == "melee") {
            let vals = i.data.guidevalue.value.split('/').map(x =>
                actorData.data.characteristics[x].value + actorData.data.characteristics[x].modifier + actorData.data.characteristics[x].advances
            );
            let parryChar = Math.max(...vals);
            i.data.parry.value = Math.ceil(i.data.talentValue.value / 2) + Math.floor((parryChar - 8) / 3);
            let attackChar = actorData.data.characteristics.mu.value + actorData.data.characteristics.mu.modifier + actorData.data.characteristics.mu.advances;
            i.data.attack.value = i.data.talentValue.value + Math.max(0, Math.floor((attackChar - 8) / 3));
        } else {
            i.data.parry.value = 0;
            let attackChar = actorData.data.characteristics.ff.value + actorData.data.characteristics.ff.modifier + actorData.data.characteristics.ff.advances;
            i.data.attack.value = i.data.talentValue.value + Math.max(0, Math.floor((attackChar - 8) / 3));
        }
        return i;
    }

    prepareItems() {
        let actorData = duplicate(this.data)
        let bodySkills = [];
        let socialSkills = [];
        let knowledgeSkills = [];
        let tradeSkills = [];
        let natureSkills = [];
        let combatskills = [];
        let advantages = [];
        let disadvantages = []
        let generalSpecialAbilites = []
        let combatSpecialAbilities = []
        let fatePointsAbilities = []

        let armor = [];
        let rangeweapons = [];
        let meleeweapons = [];

        const inventory = {
            meleeweapons: {
                items: [],
                toggle: true,
                toggleName: game.i18n.localize("equipped"),
                show: false,
                dataType: "meleeweapon"
            },
            rangeweapons: {
                items: [],
                toggle: true,
                toggleName: game.i18n.localize("equipped"),
                show: false,
                dataType: "rangeweapon"
            },
            armor: {
                items: [],
                toggle: true,
                toggleName: game.i18n.localize("equipped"),
                show: false,
                dataType: "armor"
            },
            ammunition: {
                items: [],
                show: false,
                dataType: "ammunition"
            },
            misc: {
                items: [],
                show: true,
                dataType: "miscellanous"
            }
        };

        const money = {
            coins: [],
            total: 0,
            show: true
        }



        actorData.items = actorData.items.sort((a, b) => (a.sort || 0) - (b.sort || 0))

        let totalArmor = 0;

        let totalWeight = 0;
        let encumbrance = 0;
        let carrycapacity = (actorData.data.characteristics.mu.value + actorData.data.characteristics.mu.modifier + actorData.data.characteristics.mu.advances) * 2;



        for (let i of actorData.items) {
            //try {
            i.img = i.img || DEFAULT_TOKEN;

            // *********** TALENTS ***********
            switch (i.type) {
                case "skill":
                    this.prepareSkill(i);
                    switch (i.data.group.value) {
                        case "body":
                            bodySkills.push(i);
                            break;
                        case "social":
                            socialSkills.push(i);
                            break;
                        case "knowledge":
                            knowledgeSkills.push(i);
                            break;
                        case "trade":
                            tradeSkills.push(i);
                            break;
                        case "nature":
                            natureSkills.push(i);
                            break;
                    }
                    break;
                case "combatskill":


                    combatskills.push(Actordsa5._calculateCombatSkillValues(i, actorData));
                    break;
                case "ammunition":
                    i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                    inventory.ammunition.items.push(i);
                    inventory.ammunition.show = true;
                    totalWeight += Number(i.weight);
                    break;
                case "meleeweapon":
                    i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                    i.toggleValue = i.data.worn.value || false;
                    inventory.meleeweapons.items.push(i);
                    inventory.meleeweapons.show = true;
                    totalWeight += Number(i.weight);

                    break;
                case "rangeweapon":
                    if (!i.data.quantity)
                        i.data.quantity = { value: 1 };

                    i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                    i.toggleValue = i.data.worn.value || false;
                    inventory.rangeweapons.items.push(i);
                    inventory.rangeweapons.show = true;
                    totalWeight += Number(i.weight);


                    break;
                case "armor":
                    i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                    i.toggleValue = i.data.worn.value || false;
                    inventory.armor.items.push(i);
                    inventory.armor.show = true;
                    totalWeight += Number(i.weight);

                    if (i.data.worn.value) {
                        encumbrance += i.data.encumbrance.value;
                        totalArmor += i.data.protection.value;
                        armor.push(i);
                    }


                    break;
                case "equipment":
                    i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                    inventory[i.data.equipmentType.value].items.push(i);
                    inventory[i.data.equipmentType.value].show = true;
                    totalWeight += Number(i.weight);
                    break;

                case "money":
                    i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));

                    money.coins.push(i);
                    totalWeight += Number(i.weight);

                    money.total += i.data.quantity.value * i.data.price.value;
                    break;
                case "advantage":
                    advantages.push(i)
                    break;
                case "disadvantage":
                    disadvantages.push(i)
                    break;
                case "specialability":
                    switch (i.data.category.value) {
                        case "general":
                            generalSpecialAbilites.push(i)
                            break;
                        case "combat":
                            combatSpecialAbilities.push(i)
                            break
                        case "fatePoints":
                            fatePointsAbilities.push(i)
                            break;
                    }
                    break;
            }



            /*} catch (error) {
                console.error("Something went wrong with preparing item " + i.name + ": " + error)
                ui.notifications.error("Something went wrong with preparing item " + i.name + ": " + error)
                    // ui.notifications.error("Deleting " + i.name);
                    // this.deleteEmbeddedEntity("OwnedItem", i._id);
            }*/
        }

        for (let wep of inventory.rangeweapons.items) {
            if (wep.data.worn.value) {
                rangeweapons.push(Actordsa5._prepareRangeWeapon(wep, inventory.ammunition, combatskills));
            }
        }
        for (let wep of inventory.meleeweapons.items) {
            if (wep.data.worn.value) {
                meleeweapons.push(Actordsa5._prepareMeleeWeapon(wep, combatskills, actorData));
            }
        }

        money.coins = money.coins.sort((a, b) => (a.data.price.value > b.data.price.value) ? -1 : 1);
        encumbrance += Math.max(0, Math.floor((totalWeight - carrycapacity) / 4));

        var pain = actorData.data.status.wounds.max - actorData.data.status.wounds.current;
        pain = pain <= 5 ? 4 : Math.floor(pain / 4)

        this.update({
            "data.conditions.encumbered.value": encumbrance,
            "data.conditions.inpain.value": pain
        });

        this._updateConditions()

        return {
            totalweight: totalWeight,
            totalArmor: totalArmor,
            money: money,
            encumbrance: encumbrance,
            carrycapacity: carrycapacity,
            wornRangedWeapons: rangeweapons,
            wornMeleeWeapons: meleeweapons,
            advantages: advantages,
            disadvantages: disadvantages,
            generalSpecialAbilites: generalSpecialAbilites,
            combatSpecialAbilities: combatSpecialAbilities,
            fatePointsAbilities: fatePointsAbilities,
            wornArmor: armor,
            inventory,
            combatskills: combatskills,
            allSkillsLeft: {
                body: bodySkills,
                social: socialSkills,
                nature: natureSkills
            },
            allSkillsRight: {
                knowledge: knowledgeSkills,
                trade: tradeSkills
            }
        }
    }

    _updateConditions() {
        let r = {}
        for (let [key, val] of Object.entries(this.data.data.conditions)) {
            r["data.conditions." + key + ".max"] = (val.value || 0) + (val.modifier || 0)
        }
        this.update(r)
    }

    setupWeapon(item, mode, options) {
        let title = game.i18n.localize(item.name) + " " + game.i18n.localize(mode + "test");

        let testData = {
            source: item,
            mode: mode,
            extra: {
                actor: this.data,
                options: options
            }
        };

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/combatskill-dialog.html",
            // Prefilled dialog data
            data: {
                rollMode: options.rollMode
            },
            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());

                return { testData, cardOptions };
            }
        };

        let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/combatskill-card.html", title)

        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }

    setupCombatskill(item, mode, options = {}) {
        let title = game.i18n.localize(item.name) + " " + game.i18n.localize(mode + "test");

        let testData = {
            source: item,
            mode: mode,
            extra: {
                actor: this.data,
                options: options
            }
        };

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/combatskill-dialog.html",
            // Prefilled dialog data
            data: {
                rollMode: options.rollMode
            },
            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());

                return { testData, cardOptions };
            }
        };

        let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/combatskill-card.html", title)

        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }

    setupStatus(statusId, options = {}) {
        let char = this.data.data.status[statusId];

        let title = game.i18n.localize(char.label) + " " + game.i18n.localize("Test");

        let testData = {
            source: char,
            extra: {
                statusId: statusId,
                actor: this.data,
                options: options
            }
        };

        testData.source.type = "status"

        // Setup dialog data: title, template, buttons, prefilled data
        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/status-dialog.html",
            // Prefilled dialog data
            data: {
                rollMode: options.rollMode
            },
            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());

                return { testData, cardOptions };
            }
        };

        let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/status-card.html", title)

        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }

    setupCharacteristic(characteristicId, options = {}) {
        let char = this.data.data.characteristics[characteristicId];

        let title = game.i18n.localize(char.label) + " " + game.i18n.localize("Test");

        let testData = {
            source: char,
            extra: {
                characteristicId: characteristicId,
                actor: this.data,
                options: options
            }
        };

        // Setup dialog data: title, template, buttons, prefilled data
        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/characteristic-dialog.html",
            // Prefilled dialog data
            data: {
                rollMode: options.rollMode
            },
            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.testDifficulty = DSA5.attributeDifficultyModifiers[html.find('[name="testDifficulty"]').val()];

                return { testData, cardOptions };
            }
        };

        let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/characteristic-card.html", title)

        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }

    setupSkill(skill, options = {}) {
        let title = skill.name + " " + game.i18n.localize("Test");
        let testData = {
            source: skill,
            extra: {
                actor: this.data,
                options: options,
            }
        };

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/skill-dialog.html",

            data: {
                rollMode: options.rollMode
            },
            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.testDifficulty = DSA5.skillDifficultyModifiers[html.find('[name="testDifficulty"]').val()];

                return { testData, cardOptions };
            }
        };


        let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/skill-card.html", title)


        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }

    prepareSkill(skill) {

    }

    static _prepareMeleeWeapon(item, combatskills, actorData) {
        let skill = combatskills.filter(i => i.name == item.data.combatskill.value)[0];

        item.attack = skill.data.attack.value + item.data.atmod.value;
        if (skill.data.guidevalue.value != "-") {
            let val = Math.max(...(skill.data.guidevalue.value.split("/").map(x => actorData.data.characteristics[x].value)));
            let extra = val - item.data.damageThreshold.value;
            if (extra > 0) {
                item.extraDamage = "+" + extra;
            }
        }

        item.parry = skill.data.parry.value + item.data.pamod.value;
        return item;
    }

    static _prepareRangeWeapon(item, ammunition, combatskills) {
        let skill = combatskills.filter(i => i.name == item.data.combatskill.value)[0];
        item.attack = skill.data.attack.value
        return item;
    }

    _setupCardOptions(template, title) {
        let cardOptions = {
            speaker: {
                alias: this.data.token.name,
                actor: this.data._id,
            },
            title: title,
            template: template,
            flags: { img: this.data.token.randomImg ? this.data.img : this.data.token.img }
            // img to be displayed next to the name on the test card - if it's a wildcard img, use the actor image
        }

        // If the test is coming from a token sheet
        if (this.token) {
            cardOptions.speaker.alias = this.token.data.name; // Use the token name instead of the actor name
            cardOptions.speaker.token = this.token.data._id;
            cardOptions.speaker.scene = canvas.scene._id
            cardOptions.flags.img = this.token.data.img; // Use the token image instead of the actor image
        } else // If a linked actor - use the currently selected token's data if the actor id matches
        {
            let speaker = ChatMessage.getSpeaker()
            if (speaker.actor == this.data._id) {
                cardOptions.speaker.alias = speaker.alias
                cardOptions.speaker.token = speaker.token
                cardOptions.speaker.scene = speaker.scene
                cardOptions.flags.img = speaker.token ? canvas.tokens.get(speaker.token).data.img : cardOptions.flags.img
            }
        }

        return cardOptions
    }

    async basicTest({ testData, cardOptions }, options = {}) {
        testData = await DiceDSA5.rollDices(testData, cardOptions);
        let result = DiceDSA5.rollTest(testData);

        result.postFunction = "basicTest";
        if (testData.extra)
            mergeObject(result, testData.extra);



        Hooks.call("dsa5:rollTest", result, cardOptions)

        //if (game.user.targets.size) {
        //  cardOptions.title += ` - ${game.i18n.localize("Opposed")}`;
        //  cardOptions.isOpposedTest = true
        //}

        if (!options.suppressMessage)
            DiceDSA5.renderRollCard(cardOptions, result, options.rerenderMessage).then(msg => {
                //OpposedWFRP.handleOpposedTarget(msg) // Send to handleOpposed to determine opposed status, if any.
            })
        return { result, cardOptions };
    }

    static async renderRollCard(chatOptions, testData, rerenderMessage) {
        testData.other = testData.other.join("<br>")

        let chatData = {
            title: chatOptions.title,
            testData: testData,
            hideData: game.user.isGM
        }

        if (["gmroll", "blindroll"].includes(chatOptions.rollMode)) chatOptions["whisper"] = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
        if (chatOptions.rollMode === "blindroll") chatOptions["blind"] = true;
        else if (chatOptions.rollMode === "selfroll") chatOptions["whisper"] = [game.user];

        // All the data need to recreate the test when chat card is edited
        chatOptions["flags.data"] = {
            preData: chatData.testData.preData,
            postData: chatData.testData,
            template: chatOptions.template,
            rollMode: chatOptions.rollMode,
            title: chatOptions.title,
            hideData: chatData.hideData,
            isOpposedTest: chatOptions.isOpposedTest,
            attackerMessage: chatOptions.attackerMessage,
            defenderMessage: chatOptions.defenderMessage,
            unopposedStartMessage: chatOptions.unopposedStartMessage,
            startMessagesList: chatOptions.startMessagesList
        };

        if (!rerenderMessage) {
            // Generate HTML from the requested chat template
            return renderTemplate(chatOptions.template, chatData).then(html => {
                // Emit the HTML as a chat message
                if (game.settings.get("wfrp4e", "manualChatCards")) {
                    let blank = $(html)
                    let elementsToToggle = blank.find(".display-toggle")

                    for (let elem of elementsToToggle) {
                        if (elem.style.display == "none")
                            elem.style.display = ""
                        else
                            elem.style.display = "none"
                    }
                    html = blank.html();
                }

                chatOptions["content"] = html;
                return ChatMessage.create(chatOptions, false);
            });
        } else // Update message 
        {
            // Generate HTML from the requested chat template
            return renderTemplate(chatOptions.template, chatData).then(html => {

                // Emit the HTML as a chat message
                chatOptions["content"] = html;

                return rerenderMessage.update({
                    content: html,
                    ["flags.data"]: chatOptions["flags.data"]
                }).then(newMsg => {
                    ui.chat.updateMessage(newMsg);
                    return newMsg;
                });
            });
        }
    }
}