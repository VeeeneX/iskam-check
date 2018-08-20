const puppeteer = require('puppeteer');
const slugify = require('slugify');
const nodemailer = require('nodemailer');
const {
    GMAIL_EMAIL,
    GMAIL_PASSWORD,
    MUNI_PASSWORD,
    MUNI_USERNAME,
    sendEmailIfSleepingInBoardingHouse,
    headless
} = require('./config');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: GMAIL_EMAIL,
        pass: GMAIL_PASSWORD
    },
});

const send = (mailOptions) => {
    transporter.sendMail(mailOptions, function (err, info) {
        if (err) {
            console.log(err);
        } else {
            console.log(info);
        }
    });
};

let sleepingInBoardingHouse = false;

(async () => {
    const browser = await puppeteer.launch({
        headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    /**
     * Login to iskam
     */
    await page.goto('https://iskam.skm.muni.cz');
    await page.click('#logonButt');
    await page.waitForSelector('#username');

    await page.type('#username', MUNI_USERNAME, { delay: 100 });
    await page.type('#password', MUNI_PASSWORD, { delay: 100 });

    await page.click('.btn-wrap button');
    await page.waitForSelector('.loginout');

    /**
     * Change language and search for blocks
     */
    await page.goto('https://iskam.skm.muni.cz/Localize/ChangeLang?returnUrl=%2FNovaRezervace&lang=en-US');
    await page.waitForSelector('#buttSeek');
    const elements = (await page.$$('#selBlok option')).length;
    for (let index = 1; index < elements; index++) {

        const name = await page.evaluate((index) => {
            return document.querySelector(`#selBlok > option:nth-child(${index})`).textContent
        }, index);

        const value = await page.evaluate((index) => {
            return document.querySelector(`#selBlok > option:nth-child(${index})`).value
        }, index);
        const fileName = `./type-${slugify(name)}.png`;

        await page.select('#selBlok', `${value}`);
        await page.click('#buttSeek');
        await page.waitForSelector('h3.text-centering');
        await page.screenshot({
            path: fileName
        });

        const text = await page.evaluate(() => document.querySelector('h3.text-centering').textContent);
        if (text !== 'No available beds on this block in the specified date range.') {
            const mailOptions = {
                from: GMAIL_EMAIL,
                to: GMAIL_EMAIL,
                subject: 'YES Intrak',
                html: 'Intrak',
                attachments: [
                    {
                        filename: fileName,
                        path: fileName,
                        cid: fileName
                    }
                ]
            };
            sleepingInBoardingHouse = true;
            send(mailOptions);
        } else {
            console.log('nope')
        }

        await page.waitForSelector('#buttSeek');
        await page.goto('https://iskam.skm.muni.cz/NovaRezervace');
    }


    if (!sleepingInBoardingHouse && sendEmailIfSleepingInBoardingHouse) {
        const mailOptions = {
            from: GMAIL_EMAIL,
            to: GMAIL_EMAIL,
            subject: 'NO Intrak',
            html: 'Spis pod mostom',
            attachments: [
                {
                    filename: './bridge.jpg',
                    path: './bridge.jpg',
                    cid: './bridge.jpg'
                }
            ]
        };

        send(mailOptions);
    }

    await browser.close();
})();

