// define custome validation
jQuery.validator.addMethod("equalToValue", function (value, element, param) {
    console.log(param)
    return value === param
}, "Please specify the correct value");

//-------------------------------- define variables -------------------------------------------//
const DISABLED = {
    YES: true,
    NO: false
}

const DAYTIME = {
    START: true,
    END: false
}

const COMMON_FORM_VALIDATION_OPTIONS = {
    errorElement: "span"
}

const USER_INFO_CONSTANT = {
    NAME: "user-info-name",
    EMAIL: "user-info-email",
    PASSWORD: "user-info-password",
    PASSWORD_OLD: "user-info-password-old",
    PASSWORD_NEW: "user-info-password-new"
}
class UserInfo {
    constructor(name, email, password) {
        this.name = name;
        this.email = email;
        this.password = password;
    }

    buildValidationRules = () => {
        return {
            rules: {
                userInfoName: "required",
                userInfoEmail: {
                    required: true,
                    email: true
                },
                userInfoPasswordOld: {
                    required: true,
                    equalToValue: this.password
                },
                userInfoPasswordNew: "required"
            },
            messages: {
                userInfoName: buildErrorTooltip("Vui long dien ten"),
                userInfoEmail: {
                    required: buildErrorTooltip("Vui long dien email"),
                    email: buildErrorTooltip("Email khong hop le")
                },
                userInfoPasswordOld: {
                    required: buildErrorTooltip("Vui long dien mat khau cu"),
                    equalToValue: buildErrorTooltip("Mat khau cu khong dung")
                },
                userInfoPasswordNew: buildErrorTooltip("Vui long dien mat khau moi")
            }
        }
    }

    buildEditModal = () => {
        let node = $('<div/>');
        node.append(buildInput("Ten Admin", USER_INFO_CONSTANT.NAME, this.name, "leHauBoi", DISABLED.NO));
        node.append(buildInput("Email dang nhap", USER_INFO_CONSTANT.EMAIL, this.email, "leHauBoi@gmail.com", DISABLED.NO));

        let btn = $($.parseHTML(`
            <button class="btn btn-primary btn-block" type="button">
                Doi mat khau
            </button>
        `.trim()))
        btn.click(e => {
            btn.remove();
            node.append(buildInput("Mat khau cu", USER_INFO_CONSTANT.PASSWORD_OLD, null, "Mat khau cu", DISABLED.NO));
            node.append(buildInput("Mat khau moi", USER_INFO_CONSTANT.PASSWORD_NEW, null, "Mat khau moi", DISABLED.NO));
            node.find(`#${USER_INFO_CONSTANT.PASSWORD_OLD}`).attr('type', 'password')
            node.find(`#${USER_INFO_CONSTANT.PASSWORD_NEW}`).attr('type', 'password')
        })
        node.append(btn)

        return node;
    }

    buildInfoModal = () => {
        let node = $('<div/>');
        node.append(buildInput("Ten Admin", USER_INFO_CONSTANT.NAME, this.name, "leHauBoi", DISABLED.YES));
        node.append(buildInput("Email dang nhap", USER_INFO_CONSTANT.EMAIL, this.email, "leHauBoi@gmail.com", DISABLED.YES));
        node.append(buildInput("Mat khau", USER_INFO_CONSTANT.PASSWORD, this.password.split('').map(v => '*').join(''), "Mat khau cu", DISABLED.YES));
        return node;
    }
}

//-------------------------------- end define variables ---------------------------------------//

//------------------------------- setup user info --------------------------------------------//
let userInfo;
function getUserInfo() {
    userInfo = new UserInfo('nigamon dev', 'test@dev.com', 'test');
}
getUserInfo();
$('#user-info').text(userInfo.email);
$('#user-info').click(e => {
    let editCallback = () => {
        let name = $(`#${USER_INFO_CONSTANT.NAME}`).val();
        let email = $(`#${USER_INFO_CONSTANT.EMAIL}`).val();
        let password = $(`#${USER_INFO_CONSTANT.PASSWORD_NEW}`).val();
        userInfo.name = name;
        userInfo.email = email;
        userInfo.password = password;
        hideModalById('accountModal')
        $('#user-info').text(userInfo.email);
    };
    let submitCallback = () => {
        openEditModalById(userInfo, editCallback, 'accountModal')
    }
    openInfoModalById(userInfo, submitCallback, 'accountModal')
})

//------------------------------- end setup user info ----------------------------------------//

//-------------------------------- setup button group & dropdown ---------------------------------//
function setupButtonGroup(resetCallback) {
    $('.select-one').each(function (groupIndex) {
        let group = $(this).children('button');
        group.click(function (e) {
            if ($(this).hasClass('btn-primary')) {
                $(this).removeClass('btn-primary');
                $(this).addClass('btn-outline-primary');
                if (resetCallback) {
                    resetCallback();
                }
                e.stopImmediatePropagation();
            } else {
                group.each(function (index) {
                    $(this).removeClass('btn-primary');
                    $(this).addClass('btn-outline-primary');
                });
                $(this).removeClass('btn-outline-primary');
                $(this).addClass('btn-primary');
            }
        });
    });
}

function setupDropdown() {
    $('.dropdown-menu').each(function (groupIndex) {
        let group = $(this).children('.dropdown-item');
        let labelBtn = $(this).prev();
        group.click(function (e) {
            e.preventDefault();
            group.each(function (index) {
                $(this).removeClass('active');
            });
            $(this).addClass('active');
            labelBtn.text($(this).text());
        });
    });
}

//-------------------------------- end setup button group & dropdown ----------------------------//

//------------------------------- utility functions ----------------------------------------//
// FORMAT - CONVERSION
function uniformDateFormat(date) {
    let day = date.getDate() < 10 ? ('0' + date.getDate()) : date.getDate().toString();
    let month = date.getMonth() < 9 ? ('0' + (date.getMonth() + 1)) : (date.getMonth() + 1).toString();
    let year = (date.getFullYear() % 100).toString();

    return day + '-' + month + '-' + year;
}

function parseDate(str, startOfDay) {
    let strData = str.split('-');
    let date = new Date("20" + strData[2], strData[1] - 1, strData[0]);
    if (startOfDay) {
        date.setHours(0, 0, 0, 0);
    } else {
        date.setHours(23, 59, 59, 9999);
    }
    return date;
}

function parseDateTime(str) {
    let [time, dateStr] = str.split(' ');
    let date = dateStr.split('-');
    let parsed = new Date("20" + date[2], date[1] - 1, date[0]);
    let [hour, min] = time.split(':');
    parsed.setHours(parseInt(hour), parseInt(min));
    return parsed;
}

function uniformTimeFormat(date) {
    let hour = date.getHours() < 10 ? ('0' + date.getHours()) : date.getHours().toString();
    let min = date.getMinutes() < 10 ? ('0' + date.getMinutes()) : date.getMinutes().toString();
    return hour + ':' + min;
}

function uniformDateTimeFormat(date) {
    return uniformTimeFormat(date) + " " + uniformDateFormat(date);
}

function formatMoney(number) {
    return number.toString()
        .split('')
        .reverse()
        .map((v, i) => (i !== 0 & i % 3 === 0) ? [',', v] : v)
        .flat()
        .reverse()
        .join('')
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function slugToCamelCase(str) {
    return str.split('-')
        .map((v, i) => (i === 0) ? v : capitalize(v))
        .join('');
}

// BUILD HTML
function buildRightIconWithTooltip(label, tooltip) {
    return `
        <div class="btn bg-transparent right-icon border-0 custom-tooltip">
            ${label}
            
        </div>
        <div class="tooltiptext alert alert-danger my-1 w-75">
                ${tooltip}
        </div>
    `;
}

function buildErrorTooltip(text) {
    return buildRightIconWithTooltip(
        `<i class="fa fa-exclamation-triangle text-danger" aria-hidden="true"></i>`,
        text
    )
}

function buildInput(label, id, value, placeholder, disabled) {
    let htmlStr = `
        <div class="form-group row align-items-center">
            <label class="col-md-4 control-label font-weight-bold" for="${id}">${label}</label>
            <div class="col-md-8 position-relative input-group">
                <input 
                    id="${id}" 
                    name="${slugToCamelCase(id)}" 
                    type="text" placeholder="${placeholder}"
                    class="form-control input-md rounded-0"
                    ${disabled ? "readonly" : ""}
                    ${value ? `value="${value}"` : ""}
                >
            </div>
        </div>
    `;
    return $($.parseHTML(htmlStr.trim()));
}

function buildSelect(label, id, value, options, disabled) {
    let htmlStr = `
    <div class="form-group row align-items-center">
        <label class="col-md-4 control-label font-weight-bold" for="movie-type">${label}</label>
        <div class="col-md-8">
            <select 
                id="${id}" 
                class="form-control rounded-0 pl-2"
                ${disabled ? "disabled" : ""}
            >
                ${options.map(opt => `
                    <option 
                        value=${opt.value} 
                        ${opt.value === value ? "selected" : ""}
                    >
                        ${opt.text}
                    </option>
                `).join('\n')}
            </select>
        </div>
    </div>
    `;
    return $($.parseHTML(htmlStr.trim()));
}
function buildPriceInput(label, id, value, placeholder, disabled) {
    let price = buildInput(label, id, value, placeholder, disabled);
    let empty = "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
    let priceText = $(
        `
                <div class="input-group-append">
                    <span class="input-group-text">
                        ${value ? formatMoney(value) + " VND" : empty}
                    </span>
                </div>
            `
    );
    price.find('div').append(priceText);
    price.find('input').keyup(function (e) {
        let text = $(this).val();
        if (text && containsOnlyNumber(text)) {
            priceText.find('span').text(formatMoney(text) + " VND")
        } else {
            priceText.find('span').html(empty);
        }
    })
    return price;
}

// HTML CONTROLLER
function hideModalById(id) {
    $(`#${id}`).modal('hide');
}

function openEditModalById(item, submitCallback, id) {
    let modal = $(`#${id}`);
    let body = modal.find('.modal-dialog .modal-content .modal-body');

    modal.find(`#${id}Label`).html('Chinh sua');
    body.html(item.buildEditModal());

    modal.modal('show');

    modal.find("#modal-submit").text("Luu");
    let form = modal.find('#modal-form');
    form.removeData('validator')
    form.validate({
        ...COMMON_FORM_VALIDATION_OPTIONS,
        ...item.buildValidationRules(),
    });

    form.off('submit').submit(e => {
        e.preventDefault();
        if (form.valid() && submitCallback) {
            submitCallback(body);
        }
    });
}

function openNewModalById(item, submitCallback, id) {
    let modal = $(`#${id}`);
    let body = modal.find('.modal-dialog .modal-content .modal-body');

    modal.find(`#${id}Label`).html('Them moi');
    body.html(item.buildNewModal());

    modal.modal('show');

    modal.find("#modal-submit").text("Luu");
    let form = modal.find('#modal-form');
    form.removeData('validator')
    form.validate({
        ...COMMON_FORM_VALIDATION_OPTIONS,
        ...item.buildValidationRules(),
    });

    form.off('submit').submit(e => {
        e.preventDefault();
        if (form.valid() && submitCallback) {
            submitCallback(body);
        }
    });
}

function openInfoModalById(item, submitCallback, id) {
    let modal = $(`#${id}`);
    let body = modal.find('.modal-dialog .modal-content .modal-body');

    modal.find(`#${id}Label`).html('Thong tin');
    body.html(item.buildInfoModal());

    modal.modal('show');

    modal.find("#modal-submit").text("Chinh sua");
    modal.find('#modal-form').off('submit').submit(e => {
        e.preventDefault();
        if (submitCallback) {
            submitCallback(body);
        }
    })
}

function openDeleteModalById(item, submitCallback, id) {
    let modal = $(`#${id}`);
    let body = modal.find('.modal-dialog .modal-content .modal-body');

    modal.find(`#${id}Label`).html(`
        <div class="text-danger">
            <i class="fa fa-exclamation-triangle text-danger" aria-hidden="true"></i>
            &nbsp;
            Xoa
        </div>
    `);
    body.html(item.buildDeleteModal());

    modal.modal('show');

    modal.find("#modal-submit").text("Xoa");
    modal.find('#modal-form').off('submit').submit(e => {
        e.preventDefault();
        if (submitCallback) {
            submitCallback(body);
        }
    })
}

function hideModal() {
    hideModalById('addModal')
}

function openEditModal(item, submitCallback) {
    return openEditModalById(item, submitCallback, 'addModal');
}
function openNewModal(item, submitCallback) {
    return openNewModalById(item, submitCallback, 'addModal');
}
function openInfoModal(item, submitCallback) {
    return openInfoModalById(item, submitCallback, 'addModal');
}
function openDeleteModal(item, submitCallback) {
    return openDeleteModalById(item, submitCallback, 'addModal');
}

// INIT JS
function initDatePickers(startID, endID, maxDate = new Date()) {
    initDatePickersInNode(document, startID, endID, maxDate)
}
function initDatePickersInNode(rootNode, startID, endID, maxDate = new Date()) {
    if (maxDate) {
        rootNode.find(`#${startID}:not(:disabled)`).datepicker({
            format: 'dd-mm-yy',
            width: 150,
            minDate: new Date("2000/01/01"),
            maxDate: function () {
                return $(`#${endID}`).val() ? $(`#${endID}`).val() : maxDate;
            },
        });
        rootNode.find(`#${endID}:not(:disabled)`).datepicker({
            format: 'dd-mm-yy',
            width: 150,
            minDate: function () {
                return $(`#${startID}`).val();
            },
        });
    } else {
        rootNode.find(`#${startID}:not(:disabled)`).datepicker({
            format: 'dd-mm-yy',
            width: 150,
            minDate: new Date("2000/01/01"),
            maxDate: function () {
                return $(`#${endID}`).val();
            },
        });
        rootNode.find(`#${endID}:not(:disabled)`).datepicker({
            format: 'dd-mm-yy',
            width: 150,
            maxDate: maxDate,
            minDate: function () {
                return $(`#${startID}`).val();
            },
        });
    }
}
function initDateTimePickerInNode(rootNode, id, maxDate = new Date()) {
    if (maxDate) {
        rootNode.find(`#${id}:not(:disabled)`).datetimepicker({
            format: 'HH:MM dd-mm-yy',
            width: 300,
            datepicker: {
                minDate: new Date("2000/01/01"),
                maxDate: maxDate
            },
            footer: true
        });
    } else {
        rootNode.find(`#${id}:not(:disabled)`).datetimepicker({
            format: 'HH:MM dd-mm-yy',
            width: 300,
            datepicker: {
                minDate: new Date("2000/01/01"),
            }
        });
    }
}

// MISC
function applyFilterListToItems(items, filterMap) {
    return Array.from(filterMap)
        .map(([id, filter]) => filter)
        .reduce((prevList, currentFilter) => prevList.filter(currentFilter), items);
}

function makeDelay(ms) {
    let timer = 0;
    return (callback) => {
        clearTimeout(timer);
        timer = setTimeout(callback, ms);
    }
}

function isDigit(n) {
    return [true, true, true, true, true, true, true, true, true, true][n];
}

function containsOnlyNumber(str) {
    return str.split('').every(c => isDigit(c));
}
        //------------------------------- end utility functions ------------------------------------//
