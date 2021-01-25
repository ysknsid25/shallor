const main = () => {
    //リクエストを投げて、番組表を取得する
    createFile(FILENAME, await getAandGProgarmList());

    //ファイルを読み取る
    squeezeTargetRecord(readFile(FILENAME));
};

const FILENAME = 'programList.txt';

const keywords = {
    tableTagBegin: '<table',
    tableTagEnd: '</table>',
    thTag: '<th',
    tdTag: '<td',
    tagBegin: '<',
    tagEnd: '>',
    time: 'time',
    repeat: 'bg-repeat',
    rowspanBegin: 'rowspan="',
    rowspanEnd: '"'
};


/**
 * 番組情報が入っている箇所を特定して、番組情報のみを格納した配列にして返す
 * @param textArr 
 */
const squeezeTargetRecord = (textArr) => {

    let beginFlg = false;
    let findFirstTh = false;

    

    textArr.filetr((line) => 
        {
            if(!beginFlg && findKeyWord(keywords.tableTagBegin, line)){
                beginFlg = true;
            }
            if(beginFlg){

            }
            if(findKeyWord(keywords.tableTagEnd, line)){
                return ;
            }else{
                continue;
            }

        }
    );
};

const findKeyWord = (keyword, line) =>  line.indexOf(keyword) > 0;

const getInnerHTML = (line, beginSign, keywordLength=1, endSign) => {
    const beginPos = line.indexOf(beginSign)+keywordLength;
    let substrLine = line.substring(beginPos);
    const endPos = substrLine.indexOf(endSign);
    return substrLine.substring(0, endPos);
};

/**
 * 番組表をテキスト形式で受け取って、配列に格納して返す
 *  @param Array
 */
const getAandGProgarmList = async () => {

    const API_URL = 'https://www.agqr.jp/timetable/streaming.html'; // リクエスト先URL

    const text = UrlFetchApp.fetch(API_URL).getContentText();
    return text;

};

/**
 * ファイル書き出し
 * @param {string} fileName ファイル名
 * @param {string} content ファイルの内容
 */
const createFile = (fileName, content) => {  

    const folder = DriveApp.getFolderById('1njW0RVO5Vdc0jx4kRKQeb5qv6x7WzXb4');
    const contentType = 'text/plain';
    const charset = 'utf-8';

    // Blob を作成する
    const file = Utilities.newBlob('', contentType, fileName).setDataFromString(content, charset);

    // ファイルに保存
    folder.createFile(file);
};

/**
 * ファイルを一行ずつ読み取り、配列に放り込んで返す
 * @param Array
 */
const readFile = (fileName) => 
    DriveApp.getFolderById('1njW0RVO5Vdc0jx4kRKQeb5qv6x7WzXb4')
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