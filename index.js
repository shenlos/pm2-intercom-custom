/**
 *
 * 参考源码地址:~/.pm2/modules/pm2-intercom/node_modules/pm2-intercom
 *
 */
const pm2 = require("pm2");
const async = require("async");

let process_list = {};
let process_list_cache_interval = null;

pm2.connect((err) => {
    if (err) throw err;

    pm2.launchBus((err, bus)=>{
        if (err) throw err;
        getProcessList();
        intercom(bus);
    });
});

function intercom(bus) {
    bus.on('process:msg',
        /**
         *
         * @param {Packet} packet
         */
        function(packet) {
            async.forEachLimit(process_list[packet.process.name], 3, function(proc, next) {
                sendDataToProcessId(proc.pm_id, packet);
            }, function(err) {
                if (err) console.error(err);
            });
        });
}

/**
 *
 * @param {number} proc_id
 * @param {Packet} packet
 */
function sendDataToProcessId(proc_id, packet) {
    pm2.sendDataToProcessId(proc_id, packet.raw, function(err, res) {
        if (err) console.error(err);
    });
}

function getProcessList() {
    function pm2_list() {
        pm2.list(function(err, list) {
            if (err) {
                console.error(err);
                return;
            }

            let temp_list = {};
            for (let proc of list) {
                /**
                 *  {
                 *      exec_mode: "cluster",
                 *      instance_var: 'NODE_APP_INSTANCE_B',
                 *      env: {
                 *          "instance_var": 'NODE_APP_INSTANCE_B', // 如果自定义instance_var，这里需要加上防止pm2 reload xxx 导致instance_var值和实际不一致。
                 *      }
                 *  }
                 */
                if (proc.pm2_env.exec_mode !== 'cluster_mode'){
                    continue;
                }
                if (!temp_list[proc.name]) temp_list[proc.name] = [];
                if (proc.pm2_env.instance_var &&
                    proc.pm2_env[proc.pm2_env.instance_var] === 0) {
                    temp_list[proc.name].push({
                        name : proc.name,
                        pm_id : proc.pm_id,
                        // instance_var: proc.pm2_env.instance_var,
                        // instance_var_value: proc.pm2_env[proc.pm2_env.instance_var]
                    })
                } else if (proc.pm2_env[proc.pm2_env.instance_var] === undefined) {
                    // 兼容自定义instance_var值
                    temp_list[proc.name].push({
                        name : proc.name,
                        pm_id : proc.pm_id,
                        // instance_var: proc.pm2_env.instance_var,
                        // instance_var_value: proc.pm2_env[proc.pm2_env.instance_var]
                    });
                }
            }
            process_list = temp_list;
            temp_list = null;
            console.log(process_list)
        });
    }

    pm2_list();
    process_list_cache_interval = setInterval(pm2_list, 2000);
}

function exit() {
    pm2.disconnect();
    if (process_list_cache_interval != null) clearInterval(process_list_cache_interval);
    process_list_cache_interval = null;
}

process.on('SIGINT', function() {
    exit();
    setTimeout(function() {
        process.exit(0);
    }, 200);
});

/**
 * @type {Object} Packet
 * @property {Object} Packet.process
 * @property {string} Packet.process.namespace
 * @property {string} Packet.process.name
 * @property {number} Packet.process.pm_id
 * @property {Object} Packet.raw
 * @property {string} Packet.raw.data
 * @property {string} Packet.raw.topic
 * @property {number} Packet.raw.id
 * @property {string} [Packet.raw.strategy]
 * @property {number} Packet.at
 */
