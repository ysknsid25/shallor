const GOOGLE_DRIVE_INFO = {
    DELETE_FILENAME: '.json',
    TMP_FILENAME: 'tmpProgramList.txt',
    FOLDER_ID: '1njW0RVO5Vdc0jx4kRKQeb5qv6x7WzXb4'
}

const main = async () => {

    //前回までのJSONファイルを削除する
    //七日分のでーたを消す
    getJSONfileNmInWeek().map((beforeDay) => deleteTmpFile(beforeDay + GOOGLE_DRIVE_INFO.DELETE_FILENAME));

    //リクエストを投げて、番組表を取得する
    createFile(GOOGLE_DRIVE_INFO.TMP_FILENAME, await getAandGProgarmList());

    //ファイルを読み取る
    outputJSONfile(distributeProgramData(squeezeTargetRecord(readFile(GOOGLE_DRIVE_INFO.TMP_FILENAME))));

    //ファイルを読み取ったら消す
    deleteTmpFile(GOOGLE_DRIVE_INFO.TMP_FILENAME);

};

//過去一週間分のJSONファイル名を取得する
const getJSONfileNmInWeek = () => {
    let fileNmArr = [];
    const WEEKDAY = 7;
    for(let dayBefore=WEEKDAY; dayBefore>0; dayBefore--){
        fileNmArr.push(getDate(-dayBefore));
    }
    return fileNmArr;
};

//データ取得のための目印
const keywords = {
    tableTagBegin: '<tbody',
    tableTagEnd: '</tbody>',
    tdTagBegin: '<td',
    tdTagEnd: '</td>',
    tagBegin: '<',
    tagEnd: '>',
    classBegin: 'class="',
    classEnd: '"',
    repeat: 'bg-repeat',
    first: 'bg-f',
    realtime: 'bg-l',
    rowspanBegin: 'rowspan="',
    rowspanEnd: '"',
    titleHref: '<a href='
};


/**
 * 番組情報が入っている箇所を特定して、番組情報のみを格納した配列にして返す
 * TIPS: なるほど。こういう順次系の処理は関数型より命令型のほうが向いてる
 * @param textArr 
 */
const squeezeTargetRecord = (textArr) => {

    let beginFlg = false;
    let duringTd = false;
    let programArr = [];
    let nowBetweenTdLine = 0;

    let programObj = new Object();

    const WHAT_LINE_HAS = {
        DUR_AND_BROADCAST_TYPE: 1,
        BEGIN_TIME: 3,
        TITLE: 5,
        PERSONALITY: 9
    }

    for(let i=0; i<textArr.length; i++){

        const line = textArr[i];

        //tbodyの最後が来たら、抜ける
        if(findKeyWord(keywords.tableTagEnd, line)){
            break;
        }
        //<tbodyタグを見つけたら、取り込み開始
        if(!beginFlg && findKeyWord(keywords.tableTagBegin, line)){
            beginFlg = true;
        }
        //<tbodyタグが見つかるまではスキップ
        if(!beginFlg){
            continue;
        }
        //TDタグの始まりを検知
        if(findKeyWord(keywords.tdTagBegin, line)){
            duringTd = true;
        }
        //TDの間に来たら、順番に値を取得していく
        if(duringTd){
            ++nowBetweenTdLine;
            if(WHAT_LINE_HAS.DUR_AND_BROADCAST_TYPE == nowBetweenTdLine){
                const typeStr = getInnerHTML(line, keywords.classBegin, keywords.classBegin.length, keywords.classEnd);
                programObj.dur = getDurTime(line);
                programObj.isRepeat = isRepeat(typeStr);
                programObj.isRealTime = isRealtime(typeStr);
                programObj.isFirst = isFirst(typeStr);
            }else if(WHAT_LINE_HAS.BEGIN_TIME == nowBetweenTdLine){
                const begintime = getBeginTime(line);
                programObj.beginHour = Number(begintime.substring(0, 2));
                programObj.beginMinute = Number(begintime.substring(2, 4));
                programObj.beginTime = zeroComplete(programObj.beginHour) + '' + zeroComplete(programObj.beginMinute);
                programObj.endTime = getEndTime(programObj.beginHour, programObj.beginMinute, programObj.dur);
                programObj.endHour = Number(programObj.endTime.substring(0, 2));
                programObj.endMinute = Number(programObj.endTime.substring(2, 4));
            }else if(WHAT_LINE_HAS.TITLE == nowBetweenTdLine){
                programObj.title = getTitle(line);
            }else if(WHAT_LINE_HAS.PERSONALITY == nowBetweenTdLine){
                programObj.personality = line.trim();
            }
        }
        //TDタグの終わりに来たら、オブジェクトを配列にプッシュして、初期化
        //TDの間フラグをOFFにして、カウンターをクリアする
        if(findKeyWord(keywords.tdTagEnd, line)){
            programArr.push(programObj);
            programObj = new Object();
            duringTd = false;
            nowBetweenTdLine = 0;
        }
    }

    return programArr;

};

//キーワードが含まれるか検索
const findKeyWord = (keyword, line) =>  line.indexOf(keyword) > -1;

//HTMLの中身を取得
const getInnerHTML = (line, beginSign, keywordLength, endSign) => {
    const beginPos = line.indexOf(beginSign)+keywordLength;
    let substrLine = line.substring(beginPos);
    const endPos = substrLine.indexOf(endSign);
    return substrLine.substring(0, endPos);
};

//放送時間を取得する
const getDurTime = (line) => {
    return getInnerHTML(line, keywords.rowspanBegin, keywords.rowspanBegin.length, keywords.rowspanEnd);
};

//再放送か
const isRepeat = (broadCastType) => keywords.repeat == broadCastType;

//生放送か
const isRealtime = (broadCastType) => keywords.realtime == broadCastType;

//初回放送か
const isFirst = (broadCastType) => keywords.first == broadCastType;

//0埋めする
const zeroComplete = (num) => {
    
    if(0 <= num && num < 10){
        return '0' + num;
    }

    return num;
};

//開始時刻を取得する
const getBeginTime = (line) => getDateTime(line.substring(0, 5));

//終了時刻を取得する
const getEndTime = (beginHour, beginMinute, dur) => {

    let endHour = Number(beginHour);
    let endMinute = Number(beginMinute);

    if(dur < 60){
        endMinute = endMinute + Number(dur);
    }else if(dur == 60){
        endHour = endHour + 1;
    }else if(dur > 60){
        endHour = endHour + (Math.floor(dur/60)); //放送時間(h)
        endMinute = endMinute + (dur%60); //放送時間(m)
    }

    if(endMinute == 60){
        endHour = endHour + 1;
        endMinute = 0;
    }

    return zeroComplete(endHour) + '' + zeroComplete(endMinute);
};

//タイトルを取得する
const getTitle = (line) => {

    if(findKeyWord(keywords.titleHref, line)){
        return getInnerHTML(line, keywords.tagEnd, keywords.tagEnd.length, keywords.tagBegin);
    }
    return line.trim();
};

/**
 * 番組表をテキスト形式で受け取って、配列に格納して返す
 *  @param Array
 */
const getAandGProgarmList = async () =>  UrlFetchApp.fetch('https://www.agqr.jp/timetable/streaming.html').getContentText().split('</span>\n</div>').join('</span></div>');

/**
 * ファイル書き出し
 * @param {string} fileName ファイル名
 * @param {string} content ファイルの内容
 */
const createFile = (fileName, content) => {  

    const folder = DriveApp.getFolderById(GOOGLE_DRIVE_INFO.FOLDER_ID);
    const contentType = 'text/plain';
    const charset = 'utf-8';
    const file = Utilities.newBlob('', contentType, fileName).setDataFromString(content, charset);

    folder.createFile(file);
};

//tmpファイルを削除する
const deleteTmpFile = (fileName) => DriveApp.getFilesByName(fileName).next().setTrashed(true);

/**
 * ファイルを一行ずつ読み取り、配列に放り込んで返す
 * @param Array
 */
const readFile = (fileName) => 
    DriveApp.getFolderById(GOOGLE_DRIVE_INFO.FOLDER_ID)
    .getFilesByName(fileName)
    .next()
    .getBlob()
    .getDataAsString("utf-8")
    .split('\n');


//日付・時刻の取得
//日付→YYYYMMDD
//時刻→HHMi
const getDateTime = (dateTime, isDate = false) => {
    const hourOrMonth = dateTime.substring(0, 2);
    const minuteOrDay = dateTime.substring(3, 5);

    const date = new Date();
    const year = date.getFullYear();
    const nowMonth = date.getMonth() + 1;

    //一週間単位で取得することを想定しているので、
    //年末の最終週に取得した1月のデータに関しては翌年度をセットする
    if(isDate && hourOrMonth == '01' && nowMonth == '12'){
        return '' + (year + 1) + hourOrMonth + minuteOrDay;
    }

    if(isDate){
        return '' + year + hourOrMonth + minuteOrDay;
    }

    return hourOrMonth + minuteOrDay;
};

//各曜日に対応する番組データを振り分ける
const distributeProgramData = (allProgramsArr) => {

    let firstDayProgramArr = [allProgramsArr[0]];
    let secondDayProgramArr = [allProgramsArr[1]];
    let thirdDayProgramArr = [allProgramsArr[2]];
    let fourthDayProgramArr = [allProgramsArr[3]];
    let fifthDayProgramArr = [allProgramsArr[4]];
    let sixthDayProgramArr = [allProgramsArr[5]];
    let seventhDayProgramArr = [allProgramsArr[6]];
    let programEveryDay = [];

    for(let i=7; i<allProgramsArr.length; i++){
        const programData = allProgramsArr[i].beginTime;
        const firstDayEndTime = firstDayProgramArr[firstDayProgramArr.length - 1].endTime;
        const secondDayEndTime = secondDayProgramArr[secondDayProgramArr.length - 1].endTime;
        const thirdDayEndTime = thirdDayProgramArr[thirdDayProgramArr.length - 1].endTime;
        const fourthDayEndTime = fourthDayProgramArr[fourthDayProgramArr.length - 1].endTime;
        const fifthDayEndTime = fifthDayProgramArr[fifthDayProgramArr.length - 1].endTime;
        const sixthDayEndTime = sixthDayProgramArr[sixthDayProgramArr.length - 1].endTime;
        const seventhDayEndTime = seventhDayProgramArr[seventhDayProgramArr.length - 1].endTime;

        if(programData == firstDayEndTime){
            firstDayProgramArr.push(allProgramsArr[i]);
        }else if(programData == secondDayEndTime){
            secondDayProgramArr.push(allProgramsArr[i]);
        }else if(programData == thirdDayEndTime){
            thirdDayProgramArr.push(allProgramsArr[i]);
        }else if(programData == fourthDayEndTime){
            fourthDayProgramArr.push(allProgramsArr[i]);
        }else if(programData == fifthDayEndTime){
            fifthDayProgramArr.push(allProgramsArr[i]);
        }else if(programData == sixthDayEndTime){
            sixthDayProgramArr.push(allProgramsArr[i]);
        }else if(programData == seventhDayEndTime){
            seventhDayProgramArr.push(allProgramsArr[i]);
        }
    }

    programEveryDay.push(firstDayProgramArr);
    programEveryDay.push(secondDayProgramArr);
    programEveryDay.push(thirdDayProgramArr);
    programEveryDay.push(fourthDayProgramArr);
    programEveryDay.push(fifthDayProgramArr);
    programEveryDay.push(sixthDayProgramArr);
    programEveryDay.push(seventhDayProgramArr);

    return programEveryDay;

};

//日別の番組表データごとにJSONファイルに吐き出す
const outputJSONfile = (programEveryDay) => {

    //データは月曜日が0番目に入って来るので、
    //今日の曜日を基準に日付を計算する
    const howManyDaysLaterByToday = getDayMap();
    let howManyDaysLater = -1;
    programEveryDay.map((aDayProgramDatas) => (
            createFile(getDate(howManyDaysLaterByToday[++howManyDaysLater]) + '.json', JSON.stringify(aDayProgramDatas))
    ));

};

//日付を加算した値を返す。デフォルトの場合は当日を返す
const getDate = (howManyDaysLater=0) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + howManyDaysLater);
    return dt.getFullYear() + '' + zeroComplete((dt.getMonth() + 1)) + '' + zeroComplete(dt.getDate());
};

//A&Gからのデータは、0番目は常に月曜→日曜の並びになるため、
//取得時の曜日によって、月曜日が何日かを算出する必要がある
const getDayMap = () => {

    //実行時の曜日
    const today = new Date().getDay();

    //今日の曜日に対して、各曜日にいくつ＋する必要があるか
    //インデックスに曜日を対応させているので、0が日曜日
    //中の配列は、0が月曜日になる
    const howManyDaysLaterByToday = [
        [1, 2, 3, 4, 5, 6, 0],
        [0, 1, 2, 3, 4, 5, 6],
        [6, 0, 1, 2, 3, 4, 5],
        [5, 6, 0, 1, 2, 3, 4],
        [4, 5, 6, 0, 1, 2, 3],
        [3, 4, 5, 6, 0, 1, 2],
        [2, 3, 4, 5, 6, 0, 1]
    ];

    return howManyDaysLaterByToday[today];

};
