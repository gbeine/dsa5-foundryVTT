import DSA5ChatAutoCompletion from "./chat_autocompletion.js"
import DSA5_Utility from "./utility-dsa5.js"

export default class RequestRoll {
    static async requestGC(category, name, messageId, modifier = 0) {
        const { actor, tokenId } = DSA5ChatAutoCompletion._getActor()

        if (actor) {
            game.user.updateTokenTargets([])
            let options = { modifier, cummulative: messageId }
            switch (category) {
                case "attribute":
                    break
                default:
                    const skill = actor.items.find((i) => i.name == name && i.type == category)
                    actor.setupSkill(skill.data, options, tokenId).then(async(setupData) => {
                        let result = await actor.basicTest(setupData)
                        await RequestRoll.editGroupCheckRoll(messageId, result)
                    })
            }
        }
    }

    static async editGroupCheckRoll(messageId, result) {
        let message = await game.messages.get(messageId)
        const data = message.data.flags
        const isCrit = result.result.successLevel > 1
        const critMultiplier = isCrit ? 2 : 1
        data.botched = data.botched || result.result.successLevel < -1
        const actor = DSA5_Utility.getSpeaker(result.result.speaker)
        let update = { messageId: result.result.messageId, actor: actor.name, qs: (result.result.qualityStep || 0) * critMultiplier, success: result.result.successLevel }
        let index = data.results.findIndex(x => x.messageId == update.messageId)
        if (index >= 0) {
            data.results[index] = update
        } else {
            data.results.push(update)
        }
        RequestRoll.rerenderGC(message, data)
    }

    static async requestRoll(category, name, modifier = 0) {
        const { actor, tokenId } = DSA5ChatAutoCompletion._getActor()

        if (actor) {
            game.user.updateTokenTargets([])
            let options = { modifier }

            switch (category) {
                case "attribute":
                    let characteristic = Object.keys(game.dsa5.config.characteristics).find(
                        (key) => game.i18n.localize(game.dsa5.config.characteristics[key]) == name
                    )
                    actor.setupCharacteristic(characteristic, options, tokenId).then((setupData) => {
                        actor.basicTest(setupData)
                    })
                    break
                case "regeneration":
                    actor.setupRegeneration("regenerate", options, tokenId).then((setupData) => {
                        actor.basicTest(setupData)
                    })
                    break
                default:
                    let skill = actor.items.find((i) => i.name == name && i.type == category)
                    actor.setupSkill(skill.data, options, tokenId).then((setupData) => {
                        actor.basicTest(setupData)
                    })
            }
        }
    }

    static async rerenderGC(message, data) {
        if (game.user.isGM) {
            let failed = 0
            data.qs = data.results.reduce((a, b) => {
                failed += b.success < 0 ? 1 : 0
                if (b.success > 1) failed = 0
                return a + b.qs
            }, 0)
            data.failed = failed
            data.calculatedModifier = data.modifier - failed
            data.openRolls = data.maxRolls - data.results.length
            data.doneRolls = data.results.length
            const content = await renderTemplate("systems/dsa5/templates/chat/roll/groupcheck.html", data)
            message.update({ content, flags: data })
        } else {
            game.socket.emit("system.dsa5", {
                type: "updateGroupCheck",
                payload: {
                    messageId: message.id,
                    data,
                },
            })
        }
        $("#chat-log").find(`[data-message-id="${message.id}"`).appendTo("#chat-log")
    }

    static async removeGCEntry(ev) {
        const elem = $(ev.currentTarget)
        const index = Number(elem.attr("data-index"))
        const message = game.messages.get(elem.parents(".message").attr("data-message-id"))
        const data = message.data.flags
        data.results.splice(index, 1)
        RequestRoll.rerenderGC(message, data)
    }

    static async editGC(ev) {
        const elem = $(ev.currentTarget)
        const index = Number(elem.attr("data-index"))
        const message = game.messages.get(elem.parents(".message").attr("data-message-id"))
        const data = message.data.flags
        if (index) {
            data.results[index].qs = Number(elem.val())
        } else {
            data[elem.attr("data-field")] = Number(elem.val())
        }
        RequestRoll.rerenderGC(message, data)
    }

    static chatListeners(html) {
        html.on("change", ".editGC", (ev) => RequestRoll.editGC(ev))
        html.on("click", ".request-roll", (ev) => {
            const elem = ev.currentTarget.dataset
            RequestRoll.requestRoll(elem.type, elem.name, Number(elem.modifier) || 0)
        })
        html.on("click", ".request-gc", (ev) => {
            const elem = ev.currentTarget.dataset
            RequestRoll.requestGC(
                elem.type,
                elem.name,
                $(ev.currentTarget).parents(".message").attr("data-message-id"),
                Number(elem.modifier) || 0
            )
        })
        html.on("click", ".removeGC", (ev) => RequestRoll.removeGCEntry(ev))
    }
}