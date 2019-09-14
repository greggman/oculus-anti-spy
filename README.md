# Oculus Anti Spy

This is my attempt to stop Facebook from spying on what I play on my Oculus Rift

Facebook records every app you run on your Oculus, no exceptions.

So, my solution involves

1. Stop the Oculus service
2. Run this script with `node index.js --mode=save`
3. Prevent my PC from accessing the internet (turn off Wifi or Block at router)
4. Start the Oculus service
5. Run my software
6. When done, stop the Oculus service
7. Run this script with `node index.js --mode=restore`
8. If step 7 seemed to work, run this script with `node index.js --mode=clean`
9. Re-enable the internet

## Rant

I pisses me off that some many companies spy on so much info. The USA had a law that
movie rental companies could not disclose which movies you rent. Of course Facebook
isn't disclosing which apps you run (except of course to trusted 😒 3rd parties) 
but the idea is the same to me. They shouldn't get to know that. It's my device, my PC, 
I should be able to opt out of data collection. Like a movie rental company they get
to know what apps I bought in their store but they shouldn't get to know what other
apps I run any more than the movie rental company gets to know what other movies I watch
that I didn't rent from them.

I'm sure if Facebook sold a house they'd spy on every visitor. That should be illegal IMO.

## Disclaimer

This project deletes and overwites files. The way it works is it backs up a bunch of folders. (mode=save)
Later (mode=restore) it restores all of those folders, replacing new files with old and deleting any
new files that appeared between runs. Finally it deletes the backup it made (mode=clean).
If there are any bugs it might delete the wrong files. I take no responsibility or this script
deleting the wrong files. Of course I don't want it to delete the wrong files since I use it myself
but it felt important to point out what this script does and tell you I take no responsibility if
there are any bugs and you lose data. MAKE BACKUPS!

I also have no idea if it actually works to prevent Facebook from knowing what apps I run.

## License

MIT