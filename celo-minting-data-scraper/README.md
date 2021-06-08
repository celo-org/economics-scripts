# Celo Minting Schedule scraper

Scrape a Celo archive node for data related to celo minting after each epoch.
Run:
```
$ yarn scrape <starting_epoch>
```

Will start scraping from `starting_epoch` until the most recent epoch and output to `output.csv`.