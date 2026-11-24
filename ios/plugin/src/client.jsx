import React from 'react'
import {Card,Dock} from './UI.jsx'
import {installInputBridge} from './input-bridge.js'
import {bindTheme} from './reading.js'
import {disposeStores,startStores} from './state.js'
import css from './style.css'
import {installLogoFilter} from './appearance.js'
export const name='dsh-zegao-ios-client'
export const inject=['slots','uiConversation','conversation','sessions','theme']
export const definition={
 kind:'zegao-ios-card',target:'chat',
 match(event){const s=event.type==='user/message'?event.data?.source:null;return s?.kind==='zegao-ios-operation'?{id:s.cardId||s.requestId,role:'start',exclusive:true}:null},
 start(_ctx,match){const e=match.event,s=e.data.source;return {sessionId:s.sessionId,groupId:s.cardId!==s.requestId?s.cardId:null,jobId:s.requestId,operation:s.operation,prompt:e.data.content.filter(x=>x.type==='text').map(x=>x.text).join(''),anchorSeq:e.seq}},
 update(context){return context.state},
 buildViewNode(context){const state=context.state,first=context.start??context.matches[0];if(!state||!first)return null;return {key:context.key,kind:'zegao-ios-card',id:context.id,target:'chat',anchorSeq:state.anchorSeq,location:first.location,visibility:'visible',groupTree:'turn',data:state}},
}
export function apply(ctx){
 startStores()
 if(!ctx.uiConversation?.events?.register)throw Error('择稿iOS需要Fish Pocket官方网页版的rc.4对话扩展接口')
 ctx.uiConversation.events.register(definition)
 ctx.slots.inject('conversation.chat.node',()=>ctx.slots.register({name:'conversation.chat.node',key:'zegao-ios-card',inject:sessionId=>({pluginSessionId:sessionId})},Card))
 ctx.slots.inject('conversation.input.dock',()=>ctx.slots.register({name:'conversation.input.dock',id:'zegao-ios-controls',order:80,inject:sessionId=>({pluginSessionId:sessionId,ctx})},Dock))
 ctx.effect(()=>{const style=document.createElement('style');style.dataset.plugin='dsh-zegao-ios';style.textContent=css;document.head.appendChild(style);const removeLogo=installLogoFilter();return()=>{removeLogo();style.remove()}})
 ctx.effect(()=>installInputBridge(ctx));ctx.effect(()=>bindTheme(ctx));ctx.effect(()=>()=>disposeStores())
}
