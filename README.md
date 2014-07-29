meteor-live-update
==================

> Meteor Package for sexy hot code push. I mean come on! Full page refresh in meteor? Seriously? Meteor is a fucking revolution, let's keep it that way.

<div style="font-size:smaller">
**Disclaimer**: I always wanted to make this package, but the original vision for making this package was not mine. It was my mentor James Gillmore (@faceyspacey) who paid (and guided) me to build this. We are on our way to build something truly magical, and this package (when perfected) is like 3% of what we are aiming for. Keep your eyes open for some real magic in (may be) near future ^_^
</div>

##What?
**Awesomeness**, what else? 
This package tries to do something meteor Reload/Autoupdate packages should've been doing. While developing an meteor app, it updates the templates, css, and js without doing a full page refresh. It's in very early stage and no where close to I / we (me and James) imagined, but it will be soon (hopefully). See known bugs and roadmap below. It's more or less a proof of concept for now. I mean I just got it to work by any means. This certainly doesn't mean that doing it the "proper" way is not possible. Although I believe Meteor guys would have some real solid reasons they didn't do it this way.

##Why? 
I never liked the page refreshes in meteor. I mean okay you keep the session and all, but I believe there are better ways to develop meteor apps. Meteor itself makes it easy to do that. 

##Is it really Awesome?
I don't know. I am not a pro meteor ninja (yet). I am somewhat good with javascript, similar with meteor, but my code is in no way perfect. I have only created 2-3 real world projects till date (July 18, 2014), so may be you can call me a noob.  
Now since I've said that, please feel free to point out the mistakes and tell me the right way to do things. I love to learn and constructive criticism is welcome. It's really simple (and small) code, give it a read. Comments, suggestions, advice (technical and non-technical) are welcome.

##How to install it?
```sh
mrt add live-update
```

##How to use it?
Just start developing your app. It'll come into action when you change something. It's more or less an intended replacement for Reload package, but it's too young. 


##I Want CSS Live update, but no js. It's buggy
Well, it indeed is for now. Here's what you can do in your app to enable CSS  updates only.

```javsacript
LiveUpdate.configure({
    cssOnly: true
})
```

This will update CSS live without any page refreshes, but when you change js or html, it will do usual "hot reload" from meteor, keeping your session vars and stuff safe while doing a reload.


##It's "too young" right? Then why are you releasing it?
I don't know. I don't really know how software work on the developer's side. I am just starting out making some contributions to the Open Source community and am publishing it hoping it'll motivate me to further develop it. 

# Known bugs
* $.template when used in code make the package fail

# Roadmap
Here're some rough ideas about future work on this. 
* Update only those files which are changed. For now, this package updates everything whenever anything changes. Be little more smart dude! This is not sexy
* Templates should update changed parts only. Be little more smart here as well.
* Develop a somewhat big app and use this package throughout the development
