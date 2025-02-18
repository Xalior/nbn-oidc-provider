import * as RotatingFileStream from "rotating-file-stream";

const pad = num => (num > 9 ? "" : "0") + num;

const filename_generator = (time, index) => {
    console.log("time",time,"index",index);
    if (!time) return "log/nbn-oidc-provider.log";

    const month = time.getFullYear() + "" + pad(time.getMonth() + 1);
    const day = pad(time.getDate());
    const hour = pad(time.getHours());
    const minute = pad(time.getMinutes());

    return `log/${month}${day}-${hour}${minute}-${index}-nbn-oidc-provider.log`;
};

export const logstream = RotatingFileStream.createStream(filename_generator, {
    size: "10M", // rotate every 10 MegaBytes written
    interval: "7d", // rotate daily
    compress: "gzip" // compress rotated files
});

export const log = (msg) => {
    logstream.write(msg);
    if (verbose) console.log(msg);
}

export const errorstream = RotatingFileStream.createStream(filename_generator, {
    size: "10M", // rotate every 10 MegaBytes written
    interval: "7d", // rotate daily
    compress: "gzip" // compress rotated files
});

export const error = (msg) => {
    errorstream.write(msg);
    if(verbose) console.error(msg);
}